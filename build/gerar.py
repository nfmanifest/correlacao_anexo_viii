#!/usr/bin/env python3
"""Gera o JSON de consulta do Anexo VIII a partir das planilhas oficiais.

Entradas (pasta fontes/):
  AnexoVIII-CorrelacaoItemNBSIndOpCClassTrib_IBSCBS_V*.xlsx
  TabelaClassificacaoTributaria_IBSCBS.xlsx

Saída:
  ../web/data/anexo8.json

Uso:
  python3 gerar.py             gera o JSON
  python3 gerar.py --validar   gera e imprime a conferência de integridade
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parent
FONTES = RAIZ / "fontes"
REFERENCIAS = RAIZ / "referencias"
SAIDA = RAIZ.parent / "web" / "data" / "anexo8.json"

ABA_CORRELACAO = "tabela geral"
ABA_REGRA = "REGRA inc. X"

# Grafias que a planilha usa para o mesmo local de incidência.
LOCAL_CANONICO = {
    "local da entrega ou da disponibilizacao": "Local da entrega ou da disponibilização",
    "local da entrega ou disponibilizacao": "Local da entrega ou da disponibilização",
    "domicilio principal do adquirente (estabelecimento matriz)": "Domicílio principal do adquirente (matriz)",
    "domicilio principal do adquirente": "Domicílio principal do adquirente",
    "local do imovel": "Local do imóvel",
    "local da prestacao": "Local da prestação",
    "local do evento": "Local do evento",
    "local evento": "Local do evento",
    "via explorada": "Via explorada",
}

# Conectivos que voltam para minúscula ao normalizar a caixa das descrições.
MINUSCULAS = {
    "e", "de", "da", "do", "das", "dos", "em", "ou", "por", "para", "a", "o", "as", "os",
    "na", "no", "nas", "nos", "com", "sem", "à", "às", "ao", "aos", "um", "uma", "que",
    "pela", "pelo", "sob", "entre",
}
PRESERVAR = {"Lei", "Complementar", "Brasil", "Prouni", "União", "Distrito", "Federal"}


def sem_acento(texto: str) -> str:
    return unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode().lower()


def caixa_de_sentenca(texto: str) -> str:
    """A planilha grava as descrições de item em Title Case. A LC 116 usa caixa de sentença."""

    def parte(pedaco: str) -> str:
        nucleo = re.sub(r"^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$", "", pedaco)
        if len(nucleo) >= 2 and nucleo.isupper():
            return pedaco  # siglas: ISSQN, IBS, CBS
        if any(c.isdigit() for c in nucleo):
            return pedaco
        if nucleo in PRESERVAR:
            return pedaco
        if len(nucleo) >= 2 and nucleo[1:] != nucleo[1:].lower():
            return pedaco  # IaaS, PaaS, SaaS
        return pedaco.lower()

    saida, inicio = [], True
    for token in re.split(r"(\s+)", texto):
        if not token.strip():
            saida.append(token)
            continue
        if inicio:
            saida.append(token)
        else:
            saida.append("-".join("/".join(parte(x) for x in seg.split("/")) for seg in token.split("-")))
        inicio = bool(re.search(r"[.:;]\s*$", token))
    resultado = "".join(saida).strip()
    return resultado[0].upper() + resultado[1:] if resultado else resultado


def codigo(valor, largura: int) -> str | None:
    """Códigos gravados como número perdem o zero à esquerda. Devolve sempre texto."""
    if valor is None:
        return None
    if isinstance(valor, float) and valor == int(valor):
        valor = int(valor)
    texto = str(valor).strip()
    if not texto:
        return None
    if re.fullmatch(r"\d+\.0", texto):
        texto = texto[:-2]
    return texto.zfill(largura) if texto.isdigit() else texto


def texto_limpo(valor) -> str:
    return re.sub(r"\s+", " ", str(valor or "")).strip()


def corrigir_mojibake(valor):
    """A tabela de classificação tributária vem com latin-1 lido como utf-8 em algumas colunas."""
    if not isinstance(valor, str):
        return valor
    if any(c in valor for c in ("Ã", "Â")):
        try:
            return valor.encode("latin-1", "ignore").decode("utf-8", "ignore")
        except (UnicodeDecodeError, UnicodeEncodeError):
            return valor
    return valor


def achar_fonte(padrao: str) -> Path:
    encontrados = sorted(FONTES.glob(padrao))
    if not encontrados:
        sys.exit(f"Arquivo não encontrado em {FONTES}: {padrao}")
    return encontrados[-1]


def ler_correlacao(caminho: Path) -> list[dict]:
    """Desfaz as mesclagens: cada linha passa a valer sozinha."""
    planilha = openpyxl.load_workbook(caminho)
    aba = planilha[ABA_CORRELACAO]
    colunas = 10
    grade = [[None] * (colunas + 1)]
    grade += [[None] + [aba.cell(l, c).value for c in range(1, colunas + 1)] for l in range(1, aba.max_row + 1)]
    for faixa in aba.merged_cells.ranges:
        if faixa.min_col > colunas:
            continue
        topo = aba.cell(faixa.min_row, faixa.min_col).value
        for l in range(faixa.min_row, faixa.max_row + 1):
            for c in range(faixa.min_col, min(faixa.max_col, colunas) + 1):
                grade[l][c] = topo

    linhas = []
    for numero in range(2, aba.max_row + 1):
        g = grade[numero]
        local_bruto = texto_limpo(g[8])
        linhas.append(
            {
                "linha": numero,
                "item": codigo(g[1], 0),
                "item_desc": caixa_de_sentenca(texto_limpo(g[2])),
                "nbs": texto_limpo(g[3]) or None,
                "nbs_desc": texto_limpo(g[4]),
                "onerosa": "S" if texto_limpo(g[5]).upper() == "S" else None,
                "adq_exterior": texto_limpo(g[6]).upper() or None,
                "indop": codigo(g[7], 6),
                "local": LOCAL_CANONICO.get(sem_acento(local_bruto)) if local_bruto else None,
                "cclasstrib": codigo(g[9], 6),
                "cclasstrib_nome": texto_limpo(g[10]) or None,
            }
        )
    return linhas


def ler_classificacao(caminho: Path) -> dict[str, dict]:
    aba = openpyxl.load_workbook(caminho, data_only=True).worksheets[0]
    tabela = {}
    for linha in aba.iter_rows(min_row=2, values_only=True):
        cst, cst_desc, cc, cc_desc, _tipo, lc, _reducao = (list(linha) + [None] * 7)[:7]
        chave = codigo(cc, 6)
        if not chave:
            continue
        artigo = re.match(r"\s*(Art\.\s*\d+)", str(corrigir_mojibake(lc) or ""))
        bruto = str(corrigir_mojibake(cc_desc) or "")
        tabela[chave] = {
            "cst": codigo(cst, 3),
            "tratamento": texto_limpo(corrigir_mojibake(cst_desc)),
            "nome": texto_limpo(bruto),
            # A tabela oficial corta as descrições em 100 caracteres; nesses casos a comparação
            # de texto é parcial e não vale como divergência.
            "truncado": len(bruto) >= 100,
            "artigo": artigo.group(1) if artigo else None,
        }
    return tabela


def montar_rotas(linhas: list[dict]) -> dict[str, list[dict]]:
    """Agrupa os NBS de um subitem que compartilham exatamente os mesmos ramos indOp→cClassTrib.

    É o que as mesclagens da planilha tentam expressar. Um NBS sem código entra pela descrição,
    prefixada com '§', para não se confundir com um código real.
    """
    por_item = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(set)))
    for linha in linhas:
        chave_nbs = linha["nbs"] or ("§" + linha["nbs_desc"])
        por_item[linha["item"]][chave_nbs][linha["indop"]].add(linha["cclasstrib"])

    rotas = {}
    for item, por_nbs in por_item.items():
        assinaturas = collections.defaultdict(list)
        for nbs, ramos in por_nbs.items():
            assinatura = tuple(
                sorted((indop or "", tuple(sorted(c for c in cc if c))) for indop, cc in ramos.items())
            )
            assinaturas[assinatura].append(nbs)
        lista = [
            {"nbs": sorted(nbs), "r": [{"i": indop, "c": list(cc)} for indop, cc in assinatura]}
            for assinatura, nbs in assinaturas.items()
        ]
        lista.sort(key=lambda r: (-len(r["nbs"]), r["nbs"][0]))
        rotas[item] = lista
    return rotas


def conferir(linhas, classificacao, indop_local) -> list[str]:
    avisos = []

    sem_nbs = [l["linha"] for l in linhas if not l["nbs"]]
    if sem_nbs:
        avisos.append(f"{len(sem_nbs)} linhas com descrição mas sem código NBS: {sem_nbs}")

    sem_correlacao = [l["linha"] for l in linhas if not l["indop"] and not l["cclasstrib"]]
    if sem_correlacao:
        avisos.append(f"{len(sem_correlacao)} linhas sem indOp e sem cClassTrib: {sem_correlacao}")

    sem_local = [l["linha"] for l in linhas if l["indop"] and not l["local"]]
    if sem_local:
        avisos.append(f"{len(sem_local)} linhas com indOp e sem local de incidência: {sem_local}")

    divergentes = collections.defaultdict(set)
    for linha in linhas:
        if linha["indop"] and linha["local"]:
            divergentes[linha["indop"]].add(linha["local"])
    conflitos = {k: sorted(v) for k, v in divergentes.items() if len(v) > 1}
    if conflitos:
        avisos.append(f"indOp apontando para mais de um local: {conflitos}")

    ausentes = sorted({l["cclasstrib"] for l in linhas if l["cclasstrib"]} - set(classificacao))
    if ausentes:
        avisos.append(f"cClassTrib que não existem na tabela oficial: {ausentes}")

    for cc in sorted({l["cclasstrib"] for l in linhas if l["cclasstrib"]} & set(classificacao)):
        do_anexo = next(l["cclasstrib_nome"] for l in linhas if l["cclasstrib"] == cc)
        oficial = classificacao[cc]["nome"]
        if not classificacao[cc]["truncado"] and sem_acento(do_anexo or "") != sem_acento(oficial):
            avisos.append(f"cClassTrib {cc}: nome do Anexo VIII difere do oficial\n    anexo:   {do_anexo}\n    oficial: {oficial}")

    repetidas = collections.Counter(
        (l["item"], l["nbs"], l["indop"], l["cclasstrib"]) for l in linhas
    )
    redundantes = sum(n - 1 for n in repetidas.values() if n > 1)
    if redundantes:
        avisos.append(f"{redundantes} linhas são repetição exata de outra")

    onerosa_faltando = [l["linha"] for l in linhas if (l["indop"] or "").startswith("10") and not l["onerosa"]]
    if onerosa_faltando:
        avisos.append(f"{len(onerosa_faltando)} linhas de indOp do grupo 10 sem 'PS onerosa': {onerosa_faltando}")

    return avisos


def main() -> None:
    argumentos = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    argumentos.add_argument("--validar", action="store_true", help="imprime a conferência de integridade")
    opcoes = argumentos.parse_args()

    fonte_anexo = achar_fonte("AnexoVIII-*.xlsx")
    fonte_classificacao = achar_fonte("TabelaClassificacaoTributaria*.xlsx")
    versao = re.search(r"_V(\d+\.\d+\.\d+)", fonte_anexo.name)

    linhas = ler_correlacao(fonte_anexo)
    classificacao = ler_classificacao(fonte_classificacao)
    grupos = json.loads((REFERENCIAS / "grupos-lc116.json").read_text(encoding="utf-8"))["grupos"]
    correcoes = json.loads((REFERENCIAS / "correcoes-cclasstrib.json").read_text(encoding="utf-8"))["correcoes"]

    indop_local, cclasstrib_nome, itens, nbs = {}, {}, {}, {}
    for linha in linhas:
        if linha["indop"] and linha["local"]:
            indop_local.setdefault(linha["indop"], linha["local"])
        if linha["cclasstrib"]:
            cclasstrib_nome.setdefault(linha["cclasstrib"], linha["cclasstrib_nome"])
        itens.setdefault(linha["item"], linha["item_desc"])
        if linha["nbs"]:
            nbs.setdefault(linha["nbs"], linha["nbs_desc"])

    volume = collections.Counter(l["cclasstrib"] for l in linhas if l["cclasstrib"])
    cclasstrib = {}
    for chave, nome in cclasstrib_nome.items():
        oficial = classificacao.get(chave, {})
        registro = {
            "n": nome,
            "q": volume[chave],
            "cst": oficial.get("cst"),
            "dcst": oficial.get("tratamento"),
            "art": oficial.get("artigo"),
        }
        if chave in correcoes:
            registro["n"] = correcoes[chave]["nome"]
            registro["div"] = correcoes[chave]["nota"]
        cclasstrib[chave] = registro

    rotas = montar_rotas(linhas)
    usados = sorted({item.split(".")[0] for item in rotas})
    por_grupo = collections.Counter(item.split(".")[0] for item in rotas)

    dados = {
        "meta": {
            "versao": f"v{versao.group(1)}" if versao else "desconhecida",
            "linhas": len(linhas),
            "subitens": len(itens),
            "nbs": len(nbs),
            "indop": len(indop_local),
            "cclasstrib": len(cclasstrib),
            "rotas": sum(len(r) for r in rotas.values()),
            "fonte_anexo": fonte_anexo.name,
            "fonte_cc": fonte_classificacao.name,
        },
        "itens": itens,
        "nbs": nbs,
        "indop": {k: {"l": v} for k, v in indop_local.items()},
        "cclasstrib": cclasstrib,
        "locais": dict(collections.Counter(l["local"] for l in linhas if l["local"])),
        "grupos": {g: grupos.get(g, "Item " + g) for g in usados},
        "grupoN": {g: por_grupo[g] for g in usados},
        "rotas": rotas,
    }

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    m = dados["meta"]
    print(f"{SAIDA.relative_to(RAIZ.parent)} — {SAIDA.stat().st_size // 1024} KB")
    print(f"  {m['versao']} · {m['linhas']} linhas · {m['subitens']} subitens · {m['nbs']} NBS")
    print(f"  {m['indop']} indOp · {m['cclasstrib']} cClassTrib · {m['rotas']} rotas")

    if opcoes.validar:
        avisos = conferir(linhas, classificacao, indop_local)
        print(f"\nConferência — {len(avisos)} ponto(s) de atenção")
        for aviso in avisos:
            print(f"  · {aviso}")


if __name__ == "__main__":
    main()
