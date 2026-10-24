#!/usr/bin/env python3
"""Gera a tabela completa de CST e cClassTrib do IBS e da CBS.

Fonte: planilha oficial "IT 2025.002 v.1.70 - cClassTrib.xlsx", publicada no
portal da Conformidade Fácil (SVRS) e referenciada pela documentação técnica
da Reforma Tributária do Consumo.

O script lê a aba de cClassTrib e a aba de CST, converte as datas, traduz os
indicadores por documento e grava um JSON enxuto para a consulta.

Saída:
  ../web/data/cclasstrib.json

Uso:
  python3 gerar_cclasstrib.py            gera o JSON
  python3 gerar_cclasstrib.py --validar  gera e imprime a conferência
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import date, datetime
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parent
FONTES = RAIZ / "fontes"
SAIDA = RAIZ.parent / "web" / "data" / "cclasstrib.json"

PADRAO_ARQUIVO = "IT*cClassTrib*.xlsx"
URL_CFF = "https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributaria"
URL_LC = "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm"

# Indicadores de uso por documento que interessam ao portal.
DOCUMENTOS = {
    "indnfe": "nfe",
    "indnfse": "nfse",
    "indnfcom": "nfcom",
}


def sem_acento(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in normalizado if not unicodedata.combining(c)).strip().lower()


def texto(valor) -> str:
    if valor is None:
        return ""
    return re.sub(r"\s+", " ", str(valor)).strip()


def codigo(valor, largura: int) -> str:
    bruto = texto(valor)
    if bruto.endswith(".0"):
        bruto = bruto[:-2]
    return bruto.zfill(largura)


def data(valor) -> str | None:
    if valor in (None, ""):
        return None
    if isinstance(valor, (datetime, date)):
        return valor.strftime("%Y-%m-%d")
    bruto = texto(valor)[:10]
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", bruto):
        return bruto
    return None


def achar_planilha() -> Path:
    candidatos = sorted(FONTES.glob(PADRAO_ARQUIVO))
    if not candidatos:
        sys.exit(f"Planilha não encontrada em {FONTES} (padrão {PADRAO_ARQUIVO}).")
    return candidatos[-1]


def aba(wb, prefixo: str):
    for nome in wb.sheetnames:
        if sem_acento(nome).startswith(prefixo):
            return wb[nome]
    sys.exit(f"Aba iniciada por '{prefixo}' não encontrada. Abas: {wb.sheetnames}")


def mapa_colunas(cabecalho: list) -> dict[str, int]:
    colunas = {}
    for indice, valor in enumerate(cabecalho):
        chave = sem_acento(texto(valor))
        if chave and chave not in colunas:
            colunas[chave] = indice
    return colunas


def ler_cst(ws) -> list[dict]:
    linhas = list(ws.iter_rows(values_only=True))
    if not linhas:
        sys.exit("Aba de CST vazia.")
    colunas = mapa_colunas(linhas[0])
    i_codigo = colunas.get("cst-ibs/cbs", 0)
    i_nome = colunas.get("descricao cst-ibs/cbs", 1)
    registros = []
    for linha in linhas[1:]:
        if not linha or linha[i_codigo] in (None, ""):
            continue
        registros.append({"c": codigo(linha[i_codigo], 3), "n": texto(linha[i_nome])})
    return registros


def valor(linha, indice):
    return None if indice is None else linha[indice]


def ler_cclasstrib(ws) -> tuple[list[dict], str]:
    linhas = list(ws.iter_rows(values_only=True))
    if not linhas:
        sys.exit("Aba de cClassTrib vazia.")
    colunas = mapa_colunas(linhas[0])

    def col(nome: str, padrao: int | None = None) -> int | None:
        return colunas.get(nome, padrao)

    i_cst = col("cst-ibs/cbs", 0)
    i_codigo = col("cclasstrib", 2)
    i_nome = col("nome cclasstrib", 3)
    i_desc = col("descricao cclasstrib", 4)
    i_art = col("lc 214/25")
    i_tipo = col("tipo de aliquota")
    i_red_ibs = col("predibs")
    i_red_cbs = col("predcbs")
    i_ini = col("dinivig")
    i_fim = col("dfimvig")
    i_atual = col("dataatualizacao")
    docs = {chave: col(nome) for nome, chave in DOCUMENTOS.items()}

    registros = []
    atualizacao = ""
    for linha in linhas[1:]:
        if not linha or valor(linha, i_codigo) in (None, ""):
            continue
        atual = data(valor(linha, i_atual))
        if atual and atual > atualizacao:
            atualizacao = atual
        marcados = [chave for chave, indice in docs.items() if texto(valor(linha, indice)) == "1"]
        registros.append(
            {
                "c": codigo(valor(linha, i_codigo), 6),
                "cst": codigo(valor(linha, i_cst), 3),
                "n": texto(valor(linha, i_nome)),
                "d": texto(valor(linha, i_desc)),
                "art": texto(valor(linha, i_art)) or None,
                "tipo": texto(valor(linha, i_tipo)) or None,
                "ri": int(float(texto(valor(linha, i_red_ibs)) or 0)),
                "rc": int(float(texto(valor(linha, i_red_cbs)) or 0)),
                "ini": data(valor(linha, i_ini)),
                "fim": data(valor(linha, i_fim)),
                "docs": marcados,
            }
        )
    registros.sort(key=lambda r: r["c"])
    return registros, atualizacao


def conferir(dados: dict) -> list[str]:
    problemas = []
    itens = dados["itens"]
    codigos = [i["c"] for i in itens]
    if len(codigos) != len(set(codigos)):
        problemas.append("há cClassTrib repetido")
    if any(not re.fullmatch(r"\d{6}", c) for c in codigos):
        problemas.append("código fora do padrão de 6 dígitos")
    validos = {c["c"] for c in dados["cst"]}
    for item in itens:
        if item["cst"] not in validos:
            problemas.append(f"{item['c']}: CST {item['cst']} fora da tabela de CST")
        if not item["n"] or not item["d"]:
            problemas.append(f"{item['c']}: nome ou descrição vazio")
        if item["ri"] not in (0, 30, 40, 50, 60, 70, 80, 100):
            problemas.append(f"{item['c']}: redução IBS inesperada ({item['ri']})")
        if item["rc"] not in (0, 30, 40, 50, 60, 70, 80, 100):
            problemas.append(f"{item['c']}: redução CBS inesperada ({item['rc']})")
        if not set(item["docs"]) <= {"nfe", "nfse", "nfcom"}:
            problemas.append(f"{item['c']}: documento desconhecido")
    return problemas


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--validar", action="store_true")
    args = ap.parse_args()

    caminho = achar_planilha()
    wb = openpyxl.load_workbook(caminho, data_only=True, read_only=True)
    ws_cc = aba(wb, "cclass")
    ws_cst = aba(wb, "cst")

    itens, atualizacao = ler_cclasstrib(ws_cc)
    cst = ler_cst(ws_cst)

    dados = {
        "meta": {
            "fonte": "IT 2025.002 v.1.70",
            "arquivo": caminho.name,
            "aba": ws_cc.title,
            "atualizadoEm": atualizacao or date.today().isoformat(),
            "total": len(itens),
            "url": URL_CFF,
            "urlLC": URL_LC,
        },
        "cst": cst,
        "itens": itens,
    }

    problemas = conferir(dados)
    if problemas:
        sys.exit("Falha na conferência:\n  - " + "\n  - ".join(problemas))

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    m = dados["meta"]
    print(f"{SAIDA.relative_to(RAIZ.parent)} — {SAIDA.stat().st_size / 1024:.1f} KB")
    print(f"  {m['total']} cClassTrib · {len(cst)} CST · atualizado em {m['atualizadoEm']}")
    if args.validar:
        print("  conferência: ok")


if __name__ == "__main__":
    main()
