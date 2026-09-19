#!/usr/bin/env python3
"""Gera uma versão de arquivo único, com CSS, JS e dados embutidos.

Serve para quem não tem onde hospedar: o arquivo abre com duplo clique, direto do
disco ou de uma pasta de rede, sem servidor.

Uso:
  python3 empacotar.py     escreve ../dist/correlacao-nfs.html
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "web"
SAIDA = RAIZ / "dist" / "correlacao-nfs.html"

TAG_CSS = re.compile(r'<link rel="stylesheet" href="app\.css(?:\?[^\"]*)?">')
TAG_JS = re.compile(r'<script src="app\.js(?:\?[^\"]*)?" defer></script>')

def main() -> None:
    html = (WEB / "index.html").read_text(encoding="utf-8")
    css = (WEB / "app.css").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")
    dados = (WEB / "data" / "anexo8.json").read_text(encoding="utf-8")

    # O JSON entra dentro de <script>, então qualquer '</' precisa ser escapado.
    dados = dados.replace("</", "<\\/")

    html, css_trocas = TAG_CSS.subn(lambda _: f"<style>\n{css}</style>", html)
    html, js_trocas = TAG_JS.subn(
        lambda _: f"<script>window.__ANEXO8__ = {dados};</script>\n<script>\n{js}</script>", html
    )
    if css_trocas != 1 or js_trocas != 1:
        sys.exit("index.html mudou: não foi possível localizar os arquivos CSS e JS para empacotar.")

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(html, encoding="utf-8")
    print(f"{SAIDA.relative_to(RAIZ)} — {SAIDA.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
