#!/usr/bin/env python3
"""Gera a tabela CFOP usada nas abas NF-e e NFCom.

Fonte: Ajuste SINIEF 07/01 (CONFAZ), que aprova a tabela de Código Fiscal de
Operações e Prestações. A página traz, para cada código, a descrição e a nota
explicativa de quando ele deve ser usado.

A lista de códigos aceitos na NFCom vem do MOC Online da NFCom (seção
"Tabelas e Códigos") e é conferida contra a tabela do CONFAZ: se algum código
do MOC não existir no Ajuste, o script falha em vez de inventar a descrição.

Saída:
  ../web/data/cfop.json

Uso:
  python3 gerar_cfop.py                 baixa a página do CONFAZ e gera o JSON
  python3 gerar_cfop.py --arquivo X.htm usa uma cópia local da página
  python3 gerar_cfop.py --validar       gera e imprime a conferência
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
SAIDA = RAIZ.parent / "web" / "data" / "cfop.json"

URL_CONFAZ = "https://www.confaz.fazenda.gov.br/legislacao/ajustes/2001/aj_007_01"
URL_NFCOM = "http://moc.sped.fazenda.pr.gov.br/NFCom/TabelasECodigos.html"

# CFOPs publicados no MOC Online da NFCom, seção "2. Relação de CFOP válidos".
# Conferido em 2026-10-24: 17 códigos (o 7.301 também consta da página).
NFCOM = (
    {"1.205", "5.933", "7.301"}
    | {f"5.{n}" for n in range(301, 308)}
    | {f"6.{n}" for n in range(301, 308)}
)

# Códigos que o MOC da NFCom publica mas que não constam da tabela do Ajuste
# SINIEF 07/01. Entram como complemento declarado, sem nota explicativa
# inventada: a descrição é a do próprio MOC.
COMPLEMENTOS = {
    "5.933": {
        "d": "Prestação de serviço tributado pelo ISSQN",
        "n": (
            "Código publicado no MOC Online da NFCom, seção Tabelas e Códigos. "
            "Não consta da tabela do Ajuste SINIEF 07/01, que é a base desta lista."
        ),
        "docs": ["nfcom"],
    }
}

LIMITE_NOTA = 200
CODE = re.compile(r"^(\d\.\d{3})\s*[-\u2013\u2014]\s*(.+)$")
# Todas as 460 notas começam com a mesma fórmula. Removê-la não perde conteúdo
# e economiza ~13 KB no arquivo final.
PREFIXO_NOTA = re.compile(
    r"^Classificam-se(?:,)?\s+(?:neste c[oó]digo|neste grupo|neste subgrupo)(?:,)?\s+", re.I
)


def baixar(url: str) -> str:
    pedido = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(pedido, timeout=60) as resposta:
        return resposta.read().decode("utf-8", "replace")


def linhas_de_texto(bruto: str) -> list[str]:
    texto = re.sub(r"<script[\s\S]*?</script>", " ", bruto, flags=re.I)
    texto = re.sub(r"<style[\s\S]*?</style>", " ", texto, flags=re.I)
    texto = re.sub(r"<br\s*/?>", "\n", texto, flags=re.I)
    texto = re.sub(r"</(p|div|li|tr|h[1-6]|td|th)>", "\n", texto, flags=re.I)
    texto = re.sub(r"<[^>]+>", " ", texto)
    texto = html.unescape(texto)
    linhas = (re.sub(r"\s+", " ", linha).strip() for linha in texto.split("\n"))
    return [linha for linha in linhas if linha]


def resumir(texto: str, limite: int = LIMITE_NOTA) -> str:
    """Remove a fórmula de abertura e corta no fim de uma frase."""
    texto = PREFIXO_NOTA.sub("", texto).strip()
    if texto:
        texto = texto[0].upper() + texto[1:]
    if len(texto) <= limite:
        return texto
    corte = texto[:limite]
    fim = max(corte.rfind(". "), corte.rfind("; "))
    if fim >= 80:
        return corte[: fim + 1].strip()
    espaco = corte.rfind(" ")
    return (corte[:espaco] if espaco > 0 else corte).rstrip(" ,;") + "…"


def extrair(bruto: str) -> tuple[list[dict], dict[str, str]]:
    linhas = linhas_de_texto(bruto)
    itens: list[dict] = []
    grupos: dict[str, str] = {}
    i = 0
    while i < len(linhas):
        casou = CODE.match(linhas[i])
        if not casou:
            i += 1
            continue
        codigo, descricao = casou.group(1), casou.group(2).strip()
        cabecalho = descricao == descricao.upper() and any(c.isalpha() for c in descricao)
        if cabecalho:
            if codigo.endswith("000"):
                grupos[codigo[0]] = descricao.capitalize()
            i += 1
            continue
        nota: list[str] = []
        j = i + 1
        while j < len(linhas) and not CODE.match(linhas[j]):
            if linhas[j].startswith(("Voltar para o topo", "Desenvolvido com", "Plone")):
                break
            nota.append(linhas[j])
            j += 1
        itens.append({"c": codigo, "d": descricao, "n": " ".join(nota).strip()})
        i = j
    return itens, grupos


def montar(itens: list[dict], grupos: dict[str, str]) -> dict:
    presentes = {item["c"] for item in itens}
    faltando = sorted(NFCOM - presentes - set(COMPLEMENTOS))
    if faltando:
        sys.exit("CFOP da NFCom ausente na tabela do CONFAZ e sem complemento: " + ", ".join(faltando))
    for codigo, extra in COMPLEMENTOS.items():
        if codigo not in presentes:
            itens.append({"c": codigo, "d": extra["d"], "n": extra["n"], "_complemento": True})

    registros = []
    for item in itens:
        codigo = item["c"]
        if item.get("_complemento"):
            docs = list(COMPLEMENTOS[codigo]["docs"])
        elif codigo in NFCOM:
            docs = ["nfcom"]
        else:
            docs = ["nfe"]
        registros.append(
            {
                "c": codigo,
                "d": item["d"],
                "g": codigo[0],
                "nat": "e" if codigo[0] in "123" else "s",
                "n": resumir(item["n"]),
                "docs": docs,
            }
        )

    registros.sort(key=lambda r: r["c"])
    return {
        "meta": {
            "ajuste": "Ajuste SINIEF 07/01",
            "fonte": "CONFAZ — tabela CFOP",
            "url": URL_CONFAZ,
            "urlNfcom": URL_NFCOM,
            "extraidoEm": date.today().isoformat(),
            "total": len(registros),
            "nfcom": sum(1 for r in registros if "nfcom" in r["docs"]),
            "nfe": sum(1 for r in registros if "nfe" in r["docs"]),
            "notaResumida": LIMITE_NOTA,
            "prefixoRemovido": True,
            "complementos": sorted(c for c in COMPLEMENTOS if c in {r["c"] for r in registros}),
            "aviso": (
                "Base: tabela do Ajuste SINIEF 07/01. Inclusões posteriores publicadas em "
                "ajustes específicos podem não constar; o 5.933 vem do MOC da NFCom e está "
                "marcado como complemento."
            ),
        },
        "grupos": grupos,
        "itens": registros,
    }


def conferir(dados: dict) -> list[str]:
    itens = dados["itens"]
    codigos = [i["c"] for i in itens]
    problemas = []
    if len(codigos) != len(set(codigos)):
        problemas.append("há códigos CFOP repetidos")
    if any(not re.fullmatch(r"\d\.\d{3}", c) for c in codigos):
        problemas.append("formato de código fora do padrão X.XXX")
    if set(dados["grupos"]) != set("123567"):
        problemas.append("grupos esperados: 1, 2, 3, 5, 6, 7")
    for item in itens:
        if not item["d"] or not item["n"]:
            problemas.append(f"{item['c']}: descrição ou nota vazia")
        if item["g"] not in "123567":
            problemas.append(f"{item['c']}: grupo inválido")
        if not item["docs"]:
            problemas.append(f"{item['c']}: nenhum documento")
    if {i["c"] for i in itens if "nfcom" in i["docs"]} != NFCOM:
        problemas.append("lista de CFOP da NFCom não bate com o MOC")
    return problemas


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--arquivo", type=Path, help="cópia local da página do CONFAZ")
    ap.add_argument("--validar", action="store_true")
    args = ap.parse_args()

    bruto = args.arquivo.read_text(encoding="utf-8", errors="replace") if args.arquivo else baixar(URL_CONFAZ)
    itens, grupos = extrair(bruto)
    dados = montar(itens, grupos)

    problemas = conferir(dados)
    if problemas:
        sys.exit("Falha na conferência:\n  - " + "\n  - ".join(problemas))

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    m = dados["meta"]
    print(f"{SAIDA.relative_to(RAIZ.parent)} — {SAIDA.stat().st_size / 1024:.1f} KB")
    print(f"  {m['total']} CFOPs · {m['nfe']} na NF-e · {m['nfcom']} na NFCom · {len(grupos)} grupos")
    if args.validar:
        print("  conferência: ok")


if __name__ == "__main__":
    main()
