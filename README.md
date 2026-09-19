# Correlação NFS

Ferramenta de consulta para o atendimento fiscal. O primeiro módulo organiza a correlação
do Anexo VIII: partindo do subitem da lista de serviços da LC 116/2003, mostra os NBS, o
indOp que define onde o imposto incide e o cClassTrib que define como ele é tributado — com
o CST e o artigo da LC 214/2025 de cada classificação.

As 1.521 linhas do Anexo VIII se resolvem em **268 rotas** de correlação. É essa a leitura
que a página oferece: em vez da planilha com mesclagem vertical, um fluxo por subitem com as
caixas ligadas.

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
  data/anexo8.json        dados gerados, versionados
dist/
  correlacao-nfs.html     a mesma página em arquivo único, para uso sem servidor
build/
  gerar.py                lê as planilhas oficiais e escreve web/data/anexo8.json
  empacotar.py            gera dist/correlacao-nfs.html a partir de web/
  fontes/                 planilhas oficiais, versionadas
  referencias/
    grupos-lc116.json     os 41 cabeçalhos da lista de serviços
    correcoes-cclasstrib.json  correções de rótulo conferidas na tabela oficial
```

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

## Fontes

- Anexo VIII — Correlação Item × NBS × IndOp × cClassTrib (IBS/CBS), v1.01.00
- Tabela de classificação tributária do IBS e da CBS (CST + cClassTrib)
- Nota Técnica SE/CGNFS-e nº 009/2026, de 4 de junho de 2026
- Cabeçalhos da lista de serviços: tabela de Código de Tributação Nacional

Todas em <https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc>.
