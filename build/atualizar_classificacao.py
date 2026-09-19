#!/usr/bin/env python3
"""Baixa e normaliza a tabela oficial de CST/cClassTrib publicada pelo Portal DFe.

A página oficial mantém os dados em um objeto JSON embutido. Este script preserva os
campos necessários à consulta e grava um snapshot versionado pela data de publicação.

Uso:
  python3 atualizar_classificacao.py
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


RAIZ = Path(__file__).resolve().parent
FONTES = RAIZ / "fontes"
URL_TABELA = "https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributaria"
URL_DOCUMENTACAO = "https://dfe-portal.svrs.rs.gov.br/DFe/Documentos"
PADRAO_DADOS = re.compile(
    r"var dadosOriginais = (\[.*?\]);\s*var dadosFiltrados", re.DOTALL
)


def baixar() -> bytes:
    requisicao = urllib.request.Request(
        URL_TABELA,
        headers={"User-Agent": "Correlacao-NFS/1.0 (atualizacao de fonte oficial)"},
    )
    with urllib.request.urlopen(requisicao, timeout=60) as resposta:
        return resposta.read()


def extrair(conteudo: bytes) -> dict:
    html = conteudo.decode("utf-8")
    correspondencia = PADRAO_DADOS.search(html)
    if not correspondencia:
        raise RuntimeError("A tabela JSON não foi encontrada na página oficial.")

    grupos = json.loads(correspondencia.group(1))
    classificacoes = []
    for grupo in grupos:
        for item in grupo.get("ClassificacoesTributarias") or []:
            classificacoes.append(
                {
                    "cst": grupo["Cst"],
                    "descricao_cst": grupo["NomeCst"],
                    "codigo": item["CodClassTrib"],
                    "descricao": item["NomeClassTrib"],
                    "descricao_reduzida": item["NomeReduzido"].strip(),
                    "percentual_reducao_ibs": item["PercRedIbs"],
                    "percentual_reducao_cbs": item["PercRedCbs"],
                    "tipo_aliquota": item["TipoAliq"],
                    "url_legislacao": (item.get("TexUrlLegislacao") or "").strip() or None,
                    "publicado_em": item["DthPublicacao"][:10],
                    "inicio_vigencia": item["DthIniVig"][:10],
                    "fim_vigencia": (
                        item["DthFimVig"][:10] if item.get("DthFimVig") else None
                    ),
                    "aplicavel_nfse": item["IndNfse"],
                }
            )

    classificacoes.sort(key=lambda item: item["codigo"])
    codigos = [item["codigo"] for item in classificacoes]
    if len(codigos) != len(set(codigos)):
        raise RuntimeError("A fonte oficial contém códigos cClassTrib repetidos.")

    publicacoes = sorted({item["publicado_em"] for item in classificacoes})
    publicado_em = publicacoes[-1]
    return {
        "meta": {
            "fonte": URL_TABELA,
            "documentacao": URL_DOCUMENTACAO,
            "consultado_em": datetime.now(timezone.utc).date().isoformat(),
            "publicado_em": publicado_em,
            "sha256_pagina": hashlib.sha256(conteudo).hexdigest(),
            "total_classificacoes": len(classificacoes),
        },
        "classificacoes": classificacoes,
    }


def main() -> None:
    conteudo = baixar()
    dados = extrair(conteudo)
    data_publicacao = dados["meta"]["publicado_em"]
    destino = FONTES / f"TabelaClassificacaoTributaria_IBSCBS_{data_publicacao}.json"
    destino.write_text(
        json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"{destino.relative_to(RAIZ.parent)} — "
        f"{dados['meta']['total_classificacoes']} classificações · publicação {data_publicacao}"
    )


if __name__ == "__main__":
    main()
