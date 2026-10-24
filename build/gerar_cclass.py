#!/usr/bin/env python3
"""Gera a tabela cClass (Código de Itens) da NFCom.

Fonte: Portal Nacional da NFCom (SVRS), página "Tabela de Código de Itens da
NFCom (cClass)", que publica a tabela usada para validar o campo `cClass` dos
itens. A página é guardada em build/fontes/ para que a geração seja reprodutível
sem depender da rede.

O cClass não se confunde com o cClassTrib: o primeiro classifica o item faturado
(grupos de 3 dígitos e itens de 7); o segundo classifica o tratamento do IBS e
da CBS (6 dígitos, tabela IT 2025.002).

Saída:
  ../web/data/cclass.json

Uso:
  python3 gerar_cclass.py              lê a cópia local e gera o JSON
  python3 gerar_cclass.py --baixar     atualiza a cópia local antes de gerar
  python3 gerar_cclass.py --validar    gera e imprime a conferência
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
FONTES = RAIZ / "fontes"
SAIDA = RAIZ.parent / "web" / "data" / "cclass.json"
LOCAL = FONTES / "NFCom_Tabela_cClass.html"

URL = "https://dfe-portal.svrs.rs.gov.br/NFCOM/tabelacclass"

# Colunas de indicador dos grupos, na ordem em que aparecem na página.
INDICADORES = (("deduz", 2), ("zfm", 3), ("prePago", 4), ("fatCentral", 5), ("cofat", 6))

TIPOS = {"0": "Não se aplica", "1": "Continuada", "2": "Não continuada"}


class Tabela(HTMLParser):
    """Extrai as linhas de <table id="tabelaParaExportar">."""

    def __init__(self) -> None:
        super().__init__()
        self.linhas: list[list[str]] = []
        self._linha: list[str] | None = None
        self._celula: list[str] | None = None
        self._dentro = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        atributos = dict(attrs)
        if tag == "table":
            self._dentro = atributos.get("id") == "tabelaParaExportar"
        elif not self._dentro:
            return
        elif tag == "tr":
            self._linha = []
        elif tag == "td" and self._linha is not None:
            self._celula = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "table":
            self._dentro = False
        elif not self._dentro:
            return
        elif tag == "td" and self._linha is not None and self._celula is not None:
            self._linha.append(re.sub(r"\s+", " ", "".join(self._celula)).strip())
            self._celula = None
        elif tag == "tr" and self._linha is not None:
            if self._linha:
                self.linhas.append(self._linha)
            self._linha = None

    def handle_data(self, dados: str) -> None:
        if self._celula is not None:
            self._celula.append(dados)


def baixar() -> str:
    pedido = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(pedido, timeout=90) as resposta:
        return resposta.read().decode("utf-8", "replace")


def extrair(bruto: str) -> tuple[dict[str, dict], list[dict]]:
    parser = Tabela()
    parser.feed(bruto)

    grupos: dict[str, dict] = {}
    itens: list[dict] = []
    for celulas in parser.linhas:
        codigo = celulas[0] if celulas else ""
        if re.fullmatch(r"\d{3}", codigo):
            registro: dict = {"n": celulas[1]}
            for chave, indice in INDICADORES:
                if indice < len(celulas) and celulas[indice].lower() == "sim":
                    registro[chave] = True
            grupos[codigo] = registro
        elif re.fullmatch(r"\d{7}", codigo):
            tipo = celulas[2].split(" ")[0] if len(celulas) > 2 else ""
            item: dict = {"c": codigo, "g": codigo[:3], "n": celulas[1]}
            if tipo in TIPOS:
                item["t"] = tipo
            itens.append(item)
    return grupos, itens


def montar(grupos: dict[str, dict], itens: list[dict]) -> dict:
    itens.sort(key=lambda i: i["c"])
    return {
        "meta": {
            "fonte": "NFCom — Tabela de Código de Itens (cClass)",
            "url": URL,
            "base": "MOC NFCom 1.00a e IT 2025.001 v1.01",
            "extraidoEm": date.today().isoformat(),
            "total": len(grupos) + len(itens),
            "grupos": len(grupos),
            "itens": len(itens),
            "aviso": (
                "O cClass identifica o item faturado na NFCom. Não confundir com o "
                "cClassTrib, que classifica o tratamento do IBS e da CBS."
            ),
        },
        "grupos": grupos,
        "itens": itens,
    }


def conferir(dados: dict) -> list[str]:
    grupos, itens = dados["grupos"], dados["itens"]
    codigos = list(grupos) + [i["c"] for i in itens]
    problemas: list[str] = []
    if len(codigos) != len(set(codigos)):
        problemas.append("há códigos repetidos")
    if not grupos:
        problemas.append("nenhum grupo encontrado")
    for codigo, grupo in grupos.items():
        if not grupo.get("n"):
            problemas.append(f"{codigo}: grupo sem descrição")
    for item in itens:
        if item["g"] not in grupos:
            problemas.append(f"{item['c']}: grupo {item['g']} não existe")
        elif not item["c"].startswith(item["g"]):
            problemas.append(f"{item['c']}: código não começa com o grupo {item['g']}")
        if not item.get("n"):
            problemas.append(f"{item['c']}: item sem descrição")
        if item.get("t") and item["t"] not in TIPOS:
            problemas.append(f"{item['c']}: tipo de prestação inválido")
    vazios = [c for c in grupos if not any(i["g"] == c for i in itens)]
    if vazios:
        problemas.append("grupos sem itens: " + ", ".join(sorted(vazios)))
    if dados["meta"]["total"] != len(codigos):
        problemas.append("contagem do meta não bate com as linhas")
    return problemas


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--arquivo", type=Path, help="cópia local da página")
    ap.add_argument("--baixar", action="store_true", help="atualiza a cópia local pela URL oficial")
    ap.add_argument("--validar", action="store_true")
    args = ap.parse_args()

    if args.baixar:
        FONTES.mkdir(parents=True, exist_ok=True)
        LOCAL.write_text(baixar(), encoding="utf-8")
    origem = args.arquivo or LOCAL
    if not origem.exists():
        sys.exit(f"arquivo não encontrado: {origem} (use --baixar)")

    grupos, itens = extrair(origem.read_text(encoding="utf-8", errors="replace"))
    dados = montar(grupos, itens)

    problemas = conferir(dados)
    if problemas:
        sys.exit("Falha na conferência:\n  - " + "\n  - ".join(problemas))

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    m = dados["meta"]
    print(f"{SAIDA.relative_to(RAIZ.parent)} — {SAIDA.stat().st_size / 1024:.1f} KB")
    print(f"  {m['total']} códigos · {m['grupos']} grupos · {m['itens']} itens")
    if args.validar:
        print("  conferência: ok")


if __name__ == "__main__":
    main()
