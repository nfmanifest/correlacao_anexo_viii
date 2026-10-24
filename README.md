# Correlação NFS

Ferramenta de consulta para o atendimento fiscal. O primeiro módulo organiza a correlação
do Anexo VIII: partindo do subitem da lista de serviços da LC 116/2003, mostra os NBS, o
indOp que define onde o imposto incide e o cClassTrib que define como ele é tributado — com
o CST e o artigo da LC 214/2025 de cada classificação.

As 1.521 linhas do Anexo VIII se resolvem em **268 rotas** de correlação. É essa a leitura
que a página oferece: em vez da planilha com mesclagem vertical, um fluxo por subitem com as
caixas ligadas.

A página tem cinco áreas — **NFS-e** (consulta da correlação), **NF-e 55** e **NFCom 62**
(tabelas de CFOP e, na NFCom, a tabela cClass dos itens), **Reforma Tributária** (linha do
tempo, tributos, prazos, cClassTrib, indOp e glossário) e **Fontes oficiais** (catálogo de
MOCs, schemas, NTs e tabelas de apoio) — com busca e filtros próprios em cada uma.

## Navegação, tema e catálogo

- A sidebar do portal Apps Script é a navegação única: `Início`, `NFS-e`, `NF-e 55`,
  `NFCom 62`, `Reforma Tributária` e `Fontes oficiais`. Cada item abre a área
  correspondente; não há grupo intermediário nem abas duplicadas.
- Dentro da página, as cinco áreas são painéis distintos: a consulta da NFS-e não carrega
  tabelas da Reforma Tributária, o catálogo de fontes não aparece na NFS-e e as tabelas de
  CFOP ficam nas abas de cada documento.
- Quando a página é embutida (`window.self !== window.top`), a marca, o seletor de tema
  e a barra de abas da própria página são ocultados: o portal é dono da navegação e do
  tema. A página escuta `nexo:goto` (alvos `fluxo`, `nfe`, `nfcom`, `reforma`, `fontes`
  ou uma âncora) e `nexo:theme` por `postMessage`.
- O tema é único no portal (`localStorage['nexo-theme']`, valores `light`, `dark` ou
  `system`). A página apenas aplica o tema recebido e não grava a preferência quando está
  embutida.
- O catálogo é renderizado a partir de `web/data/fontes-oficiais.json`. O HTML não repete
  títulos, critérios nem datas: tudo vem do JSON.

## Abrir

A página é estática e não tem dependências. Como ela busca os dados por `fetch`, precisa ser
servida por HTTP — abrir o arquivo direto pelo `file://` não funciona.

```bash
cd web
python3 -m http.server 8000
# http://localhost:8000
```

Se não houver onde hospedar, use a versão de arquivo único em `dist/correlacao-nfs.html`:
ela tem CSS, script e dados embutidos e abre com duplo clique, direto do disco ou de uma
pasta de rede, sem servidor nenhum.

## Publicar

### GitHub Pages

O workflow `.github/workflows/pages.yml` publica a pasta `web/` a cada push na `main`. Para
ligá-lo, vá em **Settings → Pages** e escolha **Source: GitHub Actions** — uma vez só. O
modo "deploy from a branch" não serve aqui: ele só aceita a raiz do repositório ou `/docs`,
e é por isso que a publicação passa pelo workflow.

Num repositório privado, o Pages exige plano pago. No plano gratuito, ou o repositório vira
público, ou a publicação vai para outro host.

### Outro host estático

Netlify, Vercel e Cloudflare Pages funcionam com repositório privado no plano gratuito.
Conecte o repositório e configure:

| Campo | Valor |
| --- | --- |
| Comando de build | *(vazio)* |
| Diretório publicado | `web` |

Não há dependências nem etapa de build: o conteúdo de `web/` é o site.

### Rede interna

A pasta `web/` servida por qualquer coisa que fale HTTP resolve — `python3 -m http.server`,
nginx, IIS, um bucket S3 com acesso restrito. Como é tudo estático, não há backend para
manter nem dado que saia do navegador de quem consulta.

### Arquivo único

```bash
cd build && python3 empacotar.py
```

Escreve `dist/correlacao-nfs.html` com tudo embutido. É a via mais curta para colocar a
consulta na mão do atendimento: anexar o arquivo, pôr numa pasta compartilhada ou na
intranet. Regenere depois de cada atualização dos dados.

## Estrutura

```
web/                      a página; é só isso que precisa ir para produção
  index.html
  app.css
  app.js
  data/anexo8.json        correlação da NFS-e, dados gerados e versionados
  data/cfop.json          tabela de CFOP: 461 códigos, 444 na NF-e e 17 na NFCom
  data/cclass.json        cClass da NFCom: 99 códigos, 14 grupos e 85 itens
  data/cclasstrib.json    173 códigos e 18 CST do IBS/CBS, com fundamento e vigência
  data/reforma.json       linha do tempo, tributos, prazos, mudanças e glossário
  data/fontes-oficiais.json  catálogo de 24 fontes, critérios e regras de governança
dist/
  correlacao-nfs.html     a mesma página em arquivo único, para uso sem servidor
build/
  gerar.py                lê as planilhas oficiais e escreve web/data/anexo8.json
  gerar_cfop.py           lê os PDFs oficiais de CFOP e escreve web/data/cfop.json
  gerar_cclass.py         lê a tabela oficial de cClass da NFCom e escreve web/data/cclass.json
  gerar_cclasstrib.py     lê a planilha oficial de cClassTrib e escreve web/data/cclasstrib.json
  empacotar.py            gera dist/correlacao-nfs.html a partir de web/
  fontes/                 planilhas e PDFs oficiais, versionados
  referencias/
    grupos-lc116.json     os 41 cabeçalhos da lista de serviços
    correcoes-cclasstrib.json  correções de rótulo conferidas na tabela oficial
```

## Uso no portal Apps Script

O projeto Apps Script (portal Nexo Fiscal) não mantém cópia de `web/`. O `Code.gs` carrega
os nove arquivos deste repositório (`web/index.html`, `app.css`, `app.js`,
`data/anexo8.json`, `data/fontes-oficiais.json`, `data/cfop.json`, `data/cclass.json`,
`data/cclasstrib.json` e `data/reforma.json`), embute CSS, JavaScript e JSON no iframe e usa
`installAssets()` apenas como cache versionado em `PropertiesService`.

A fonte única de verdade é este repositório. Para atualizar o portal, altere `web/`, rode
`python build/empacotar.py` (se usar o arquivo único) e execute `installAssets()` no Apps
Script para regravar o cache.

## Atualizar quando sair uma versão nova

```bash
pip install -r requirements.txt
# coloque a planilha nova em build/fontes/, sem apagar a antiga
cd build
python3 gerar.py --validar
```

Depois, se usar a versão de arquivo único, rode `python3 empacotar.py`.

O gerador localiza as planilhas por padrão de nome e usa a de versão mais alta, então basta
acrescentar a nova sem apagar a antiga — o `git diff` de `web/data/anexo8.json` passa a
mostrar exatamente o que mudou na correlação. Ele reescreve o JSON e, com `--validar`,
imprime a conferência de integridade. A página lê a versão, as contagens e o
nome das fontes do próprio JSON, então o cabeçalho e o rodapé se atualizam sozinhos.

O que o gerador faz com a planilha:

- desfaz as 2.258 mesclagens, deixando cada linha completa e independente;
- grava todo código como texto de seis dígitos, preservando o zero à esquerda;
- unifica as grafias do local de incidência (`local do evento`, `local do Evento` e
  `local evento` são o mesmo);
- normaliza a caixa das descrições de item, que a planilha grava em Title Case;
- agrupa em rotas os NBS de um subitem que compartilham os mesmos ramos indOp → cClassTrib;
- cruza cada cClassTrib com a tabela oficial para trazer CST, tratamento e artigo da LC 214/2025.

Nenhum dado é inventado. As lacunas da planilha continuam lacunas e aparecem marcadas em
vermelho no fluxo.

### Tabelas de CFOP (NF-e e NFCom)

As abas **NF-e 55** e **NFCom 62** são geradas por `build/gerar_cfop.py` a partir dos PDFs
oficiais em `build/fontes/`:

```bash
python build/gerar_cfop.py --validar
```

O resultado é `web/data/cfop.json`, com 461 códigos, a descrição, a nota explicativa e o
grupo de cada um. A NF-e usa 444 códigos do Ajuste SINIEF 07/01; a NFCom usa 17 códigos do
MOC Online da NFCom. O `5.933` não consta do Ajuste e entra como complemento declarado, com
a descrição do próprio MOC. O gerador falha se um CFOP da NFCom não existir nem na base nem
na lista de complementos — é a trava contra código inventado.

### Tabela de cClass (NFCom)

A aba **NFCom 62** usa `web/data/cclass.json`, gerado por `build/gerar_cclass.py` a partir da
tabela oficial de código de itens do Portal Nacional da NFCom:

```bash
python build/gerar_cclass.py --validar
```

São 99 códigos: 14 grupos de 3 dígitos e 85 itens de 7 dígitos, com descrição e tipo de
prestação. O grupo carrega os indicadores que mudam a totalização — dedução do valor total
(`590`), CBS zero para ZFM/ALC (`060`, `080`, `110`), pré-pago (`050`), faturamento
centralizado (`120`) e cofaturamento (`130`). A página traz busca, filtro por grupo e os
selos de cada indicador.

O **cClass** não se confunde com o **cClassTrib**: o primeiro classifica o item faturado na
NFCom; o segundo classifica o tratamento do IBS e da CBS e vale para os demais documentos.
A chave interna do Anexo VIII que guarda os 28 códigos de classificação tributária chama-se
`cclasstrib`, justamente para não repetir a confusão.

### Tabela de cClassTrib

A aba **Reforma Tributária** usa `web/data/cclasstrib.json`, gerado por
`build/gerar_cclasstrib.py` a partir da planilha IT 2025.002 v.1.70:

```bash
python build/gerar_cclasstrib.py --validar
```

São 173 códigos e 18 CST, com nome, descrição, fundamento na LC 214/2025, tipo de alíquota,
reduções de IBS e CBS, vigência e documentos em que cada código é aceito. Os 28 códigos que
aparecem no Anexo VIII recebem o selo "Anexo VIII" e podem ser isolados por filtro.

### Conteúdo editorial da Reforma

`web/data/reforma.json` guarda o texto da aba: linha do tempo de 2026 a 2033, os três
tributos (CBS, IBS e IS), os cinco tributos substituídos, as mudanças de regra, os prazos e
o glossário. É conteúdo editorial versionado — ao corrigir uma data ou um prazo, edite o
JSON e rode `python build/empacotar.py`.

## O que conferir antes de confiar na resposta

A conferência das 1.521 linhas contra a tabela oficial de classificação tributária apontou:

| | |
| --- | --- |
| **Base de indOp defasada** | Esta correlação é a v1.01.00, de 1º de abril de 2026, montada sobre o AnexoVII-IndOp v1.01.00. A NT 009/2026, de 4 de junho, publicou o AnexoVII-IndOp **v1.02.00**, e o Anexo VIII não foi reemitido desde então. |
| **cClassTrib 200042** | A planilha o chama de "educação desportiva (art. 141. II)", que é o nome do 200041. O correto, pela tabela oficial, é "gestão e exploração do desporto". Corrigido na geração, via `correcoes-cclasstrib.json`. |
| **16 linhas sem código NBS** | Têm descrição do serviço, mas a célula do código está vazia. Aparecem como `sem código` no fluxo. |
| **Subitem 99.01.01** | Única linha sem indOp, sem local e sem cClassTrib. Aparece com o bloco de alerta no fluxo. |
| **7 linhas redundantes** | Repetições exatas, sem efeito na consulta. |
| **6 linhas do subitem 09.02** | Usam indOp do grupo 10 sem preencher "PS onerosa" e "Adq. exterior", que são justamente o que decide o código. |

Vale lembrar que o Anexo VIII é publicado como trabalho em construção, sem regras de
validação vinculadas a ele em produção nem no piloto RTC. Sugestões de correção vão para
`atendimento.nfs-e@rfb.gov.br`, com "AnexoVIII" no título.

## Detalhe que confunde

`indOp` e Código de Tributação Nacional usam os mesmos seis dígitos e não são a mesma coisa.
`050101` é "local da prestação" como indOp e 5.01.01 como código de tributação nacional.

`cClass` e `cClassTrib` também não são a mesma coisa. O cClass tem 3 ou 7 dígitos e diz qual
item foi faturado na NFCom; o cClassTrib tem 6 dígitos (os 3 primeiros são o CST) e diz como
o IBS e a CBS incidem sobre esse item. Um aparece na aba NFCom, o outro na Reforma Tributária.

## Fontes

- Anexo VIII — Correlação Item × NBS × IndOp × cClassTrib (IBS/CBS), v1.01.00
- Tabela de classificação tributária do IBS e da CBS (CST + cClassTrib)
- Nota Técnica SE/CGNFS-e nº 009/2026, de 4 de junho de 2026
- Cabeçalhos da lista de serviços: tabela de Código de Tributação Nacional
- Ajuste SINIEF 07/01 — tabela nacional de CFOP
- IT 2023.002 v2.00 — tabela de CFOP da NF-e
- MOC Online da NFCom — tabelas e códigos
- Tabela de código de itens da NFCom (cClass)
- IT 2025.002 v1.70 — planilha de CST e cClassTrib
- LC 214/2025 e páginas da Receita Federal sobre a Reforma Tributária do Consumo

As fontes da NFS-e estão em <https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc>.
O catálogo completo, com 24 links e o critério de uso de cada um, fica na aba **Fontes
oficiais** e em `web/data/fontes-oficiais.json`.
