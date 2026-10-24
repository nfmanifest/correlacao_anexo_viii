# Relatório de validação

Data da execução: 24/10/2026
Branch: `feat/navegacao-unica`
Versão da interface: `2026-10-24.3`

## Resultado

| Verificação | Resultado |
| --- | --- |
| Harness do `Code.gs` + dados + `dist` | **132 verificações, 0 falhas** |
| Gerador de CFOP (`--validar`) | ok — 461 CFOPs, 444 NF-e, 17 NFCom |
| Gerador de cClass (`--validar`) | ok — 99 códigos, 14 grupos, 85 itens |
| Gerador de cClassTrib (`--validar`) | ok — 173 códigos, 18 CST |
| Empacotador | ok — `dist/correlacao-nfs.html` com 470.820 bytes (459,8 KiB) |
| Console do navegador | sem erros e sem avisos |
| `node --check` no `Code.gs` | ok |

Limite combinado para o arquivo único: ~460 KiB. O artefato ficou em 459,8 KiB. O
empacotador passou a gravar o HTML com quebras de linha LF; com CRLF o mesmo conteúdo
ocupava 473.272 bytes e estourava o limite sem nenhum ganho de conteúdo.

## Dados gerados

### CFOP — `web/data/cfop.json`

| | |
| --- | --- |
| Total | 461 códigos |
| NF-e (modelo 55) | 444 |
| NFCom (modelo 62) | 17 |
| Grupos | 1, 2, 3, 5, 6, 7 |
| Complemento declarado | `5.933` (MOC NFCom; ausente do Ajuste SINIEF 07/01) |
| Tamanho | 130,3 KB |

Conferências: sem códigos duplicados, todos com descrição e nota, sem boilerplate de
navegação do CONFAZ. O gerador falha se um CFOP da NFCom não existir nem na base nem na
lista de complementos.

### cClass — `web/data/cclass.json`

| | |
| --- | --- |
| Total | 99 códigos |
| Grupos (3 dígitos) | 14 |
| Itens (7 dígitos) | 85 |
| Fonte | Tabela de código de itens da NFCom (SVRS) |
| Base | MOC NFCom 1.00a e IT 2025.001 v1.01 |
| Tamanho | 7,6 KB |

Conferências: sem códigos duplicados, todo item pertence a um grupo existente e começa pelo
código do grupo, todos têm descrição e tipo de prestação válido. Os indicadores conferidos
são dedução (`590`), CBS zero ZFM/ALC (`060`, `080`, `110`), pré-pago (`050`), faturamento
centralizado (`120`) e cofaturamento (`130`).

### cClassTrib — `web/data/cclasstrib.json`

| | |
| --- | --- |
| Total | 173 códigos |
| CST | 18 |
| Códigos do Anexo VIII | 28 |
| Fonte | IT 2025.002 v.1.70, atualizada em 01/10/2026 |
| Tamanho | 71,4 KB |

Conferências: sem códigos duplicados, todo `cst` existe na lista de 18, todo `docs` usa
apenas `nfe`, `nfse` ou `nfcom`, e os 28 códigos do Anexo VIII estão presentes.

### Reforma — `web/data/reforma.json`

| Bloco | Itens |
| --- | --- |
| Linha do tempo | 8 anos (2026 a 2033) |
| Tributos | 3 (CBS, IBS, IS) |
| Tributos substituídos | 5 |
| Mudanças | 8 |
| Prazos | 7 |
| Glossário | 17 termos |

As três fontes do bloco (`meta.fontes`) apontam para páginas oficiais da Receita Federal e
para o texto da LC 214/2025 no Planalto.

### Fontes oficiais — `web/data/fontes-oficiais.json`

24 fontes, todas com URL `http` ou `https`, atualizadas em 24/10/2026. Inclui Ajuste SINIEF
07/01, IT 2023.002 v2.00 (CFOP), MOC NFCom, tabela cClass da NFCom, IT 2025.002 v1.70
(cClassTrib), LC 214/2025 e as páginas da Receita Federal sobre a Reforma.

## Testes no navegador

Servidor local em `http://localhost:8788` servindo `web/`.

| Área | Teste | Resultado |
| --- | --- | --- |
| NFS-e | contagem inicial | 208 subitens |
| NF-e 55 | linhas da tabela | 444 |
| NF-e 55 | filtro de grupo `5` | 108 de 444 |
| NF-e 55 | busca `5102` | 1 de 444 (5.102) |
| NF-e 55 | nota expansível | abre, fecha e atualiza `aria-expanded` |
| NFCom 62 | linhas da tabela | 17 |
| NFCom 62 | busca `5.933` | 1 de 17 |
| NFCom 62 | tabela cClass | 85 itens e 14 grupos |
| NFCom 62 | filtro de grupo `590` | 5 de 85, com selo “Deduz do total” |
| NFCom 62 | busca `fibra` | 1 de 85 (0801101) |
| NFCom 62 | busca sem resultado | 0 de 85 |
| NFCom 62 | contador restaurado | 85 itens e 14 grupos |
| Reforma | cClassTrib | 173 classificações |
| Reforma | linha do tempo | 8 itens, 1 marcado como ano corrente |
| Reforma | tributos | 3 cartões |
| Reforma | substituídos | 5 linhas |
| Reforma | mudanças | 8 cartões |
| Reforma | prazos | 7 itens |
| Reforma | glossário | 17 termos |
| Reforma | filtro Anexo VIII | 28 de 173 |
| Reforma | filtro CST `000` | 6 de 173 |
| Reforma | filtro documento `nfcom` | 16 de 173 |
| Reforma | busca `200015` | 1 de 173 |
| Reforma | indOp `100101` | 1 de 19 |
| Reforma | detalhe expansível | abre com descrição, fundamento, alíquota, vigência e documentos |
| Fontes | cartões | 24 |
| Fontes | busca `CFOP` | 3 |
| Tema | alternância e `localStorage` | ok (`nexo-theme`) |
| URL | `?tab=nfe`, `?tab=nfcom`, `?tab=reforma`, `?tab=fontes` | ok |

## Arquivo único e iframe

- `dist/correlacao-nfs.html` abre direto do disco e pelo servidor local.
- Contém os seis globais: `__ANEXO8__`, `__FONTES__`, `__CFOP__`, `__CCLASS__`,
  `__CCLASSTRIB__` e `__REFORMA__`.
- Sem `href="app.css"` e sem `src="app.js"`: CSS e JavaScript estão embutidos.
- Em iframe, a marca, o seletor de tema e as abas da página ficam ocultos.
- `postMessage` `nexo:goto` funcionou para `nfe`, `nfcom` e `reforma`.
- `postMessage` `nexo:theme` aplicou o tema claro no iframe.
- O shell do portal (`_preview_portal.html`) abriu a aba NFCom e exibiu os 85 itens de
  cClass dentro do iframe, com `data-ui-version="2026-10-24.3"`.

## O que o harness cobre

O harness (`nexo_validate/harness.js`) executa o `Code.gs` em um contexto `vm` com
`UrlFetchApp` simulado e confere:

1. configuração dos 9 assets e ausência das funções de injeção antigas;
2. autorização por domínio e por lista de e-mails;
3. home antes e depois de `installAssets()`, incluindo sidebar, menu de configurações,
   opções de tema, cards disponíveis e ausência de placeholder;
4. fallback da NFS-e pelo GitHub e leitura do cache em `PropertiesService`;
5. presença dos seis globais e das cinco abas na ordem correta;
6. separação real entre as áreas: tabelas só na Reforma, catálogo só em Fontes, CFOP só nas
   abas de documento e cClass só na NFCom;
7. integridade dos JSONs de CFOP, cClass, cClassTrib, Reforma e Fontes;
8. recursos esperados em `app.js` e `app.css`;
9. o arquivo único em `dist/`.

## Como repetir

```bash
python build/gerar_cfop.py --validar
python build/gerar_cclass.py --validar
python build/gerar_cclasstrib.py --validar
python build/empacotar.py

# copie o Code.gs para a pasta do harness e rode:
node harness.js
```

Saída esperada no harness:

```
verificações: 132
falhas: nenhuma
```
