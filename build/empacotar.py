#!/usr/bin/env python3
"""Gera uma versão de arquivo único, com CSS, JS e dados embutidos.

Serve para quem não tem onde hospedar: o arquivo abre com duplo clique, direto do
disco ou de uma pasta de rede, sem servidor.

Uso:
  python3 empacotar.py     escreve ../dist/correlacao-nfs.html
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "web"
SAIDA = RAIZ / "dist" / "correlacao-nfs.html"

TAG_CSS = re.compile(r'<link rel="stylesheet" href="app\.css(?:\?[^\"]*)?">')
TAG_JS = re.compile(r'<script src="app\.js(?:\?[^\"]*)?" defer></script>')

def minificar(texto: str) -> str:
    """Remove a indentação dos JSON sem alterar o conteúdo."""
    return json.dumps(json.loads(texto), ensure_ascii=False, separators=(",", ":"))

def minificar_js(texto: str) -> str:
    """Remove a indentação e as linhas vazias; o JavaScript não usa template literals."""
    linhas = (linha.strip() for linha in texto.split("\n"))
    return "\n".join(linha for linha in linhas if linha)

def minificar_css(texto: str) -> str:
    """Compacta o CSS preservando o conteúdo de strings."""
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    saida = []
    i, n, aspas = 0, len(texto), None
    while i < n:
        c = texto[i]
        if aspas:
            saida.append(c)
            if c == "\\" and i + 1 < n:
                saida.append(texto[i + 1])
                i += 2
                continue
            if c == aspas:
                aspas = None
            i += 1
            continue
        if c in "'\"":
            aspas = c
            saida.append(c)
            i += 1
            continue
        if c.isspace():
            while i < n and texto[i].isspace():
                i += 1
            saida.append(" ")
            continue
        saida.append(c)
        i += 1
    texto = "".join(saida)
    texto = re.sub(r"\s*([{};,])\s*", r"\1", texto)
    texto = re.sub(r"\s*>\s*", ">", texto)
    texto = re.sub(r":\s+", ":", texto)
    return texto.replace(";}", "}").strip()

def main() -> None:
    html = (WEB / "index.html").read_text(encoding="utf-8")
    css = minificar_css((WEB / "app.css").read_text(encoding="utf-8"))
    js = minificar_js((WEB / "app.js").read_text(encoding="utf-8"))
    dados = minificar((WEB / "data" / "anexo8.json").read_text(encoding="utf-8"))
    fontes = minificar((WEB / "data" / "fontes-oficiais.json").read_text(encoding="utf-8"))
    cfop = minificar((WEB / "data" / "cfop.json").read_text(encoding="utf-8"))
    cclass = minificar((WEB / "data" / "cclass.json").read_text(encoding="utf-8"))
    cclasstrib = minificar((WEB / "data" / "cclasstrib.json").read_text(encoding="utf-8"))
    reforma = minificar((WEB / "data" / "reforma.json").read_text(encoding="utf-8"))
    lc214 = minificar((WEB / "data" / "lc214.json").read_text(encoding="utf-8"))

    # Os JSON entram dentro de <script>, então qualquer '</' precisa ser escapado.
    dados = dados.replace("</", "<\\/")
    fontes = fontes.replace("</", "<\\/")
    cfop = cfop.replace("</", "<\\/")
    cclass = cclass.replace("</", "<\\/")
    cclasstrib = cclasstrib.replace("</", "<\\/")
    reforma = reforma.replace("</", "<\\/")
    lc214 = lc214.replace("</", "<\\/")

    html, css_trocas = TAG_CSS.subn(lambda _: f"<style>\n{css}</style>", html)
    html, js_trocas = TAG_JS.subn(
        lambda _: (
            f"<script>window.__ANEXO8__ = {dados};"
            f"window.__FONTES__ = {fontes};"
            f"window.__CFOP__ = {cfop};"
            f"window.__CCLASS__ = {cclass};"
            f"window.__CCLASSTRIB__ = {cclasstrib};"
            f"window.__REFORMA__ = {reforma};"
            f"window.__LC214__ = {lc214};</script>\n<script>\n{js}</script>"
        ),
        html,
    )
    if css_trocas != 1 or js_trocas != 1:
        sys.exit("index.html mudou: não foi possível localizar os arquivos CSS e JS para empacotar.")

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(html, encoding="utf-8", newline="\n")
    print(f"{SAIDA.relative_to(RAIZ)} — {SAIDA.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
