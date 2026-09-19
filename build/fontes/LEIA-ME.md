# Planilhas de origem

Os arquivos desta pasta são snapshots das fontes oficiais e estão versionados para que
`gerar.py` rode sem download nenhum.

| Arquivo | O que é |
| --- | --- |
| `AnexoVIII-CorrelacaoItemNBSIndOpCClassTrib_IBSCBS_V1.01.00.xlsx` | A correlação entre subitem da LC 116, NBS, indOp e cClassTrib. Gravado em 1º de abril de 2026. |
| `TabelaClassificacaoTributaria_IBSCBS_2026-06-22.json` | Os 164 cClassTrib publicados pelo Portal DFe/SVRS, com CST, descrições, reduções, vigência e referência legal. |
| `TabelaClassificacaoTributaria_IBSCBS.xlsx` | Snapshot histórico anterior, com 154 códigos. Mantido somente para rastreabilidade. |

Origens:

- Anexo VIII: <https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc>
- CST e cClassTrib: <https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributaria>
- Documentação da tabela: <https://dfe-portal.svrs.rs.gov.br/DFe/Documentos>

## Quando sair uma versão nova

Para atualizar CST/cClassTrib, rode `python3 build/atualizar_classificacao.py` na raiz do
repositório. O script extrai os dados publicados, rejeita códigos duplicados e grava um novo
snapshot por data de publicação.

Quando o Anexo VIII for republicado, baixe a nova planilha e coloque aqui **sem apagar a
antiga**. O gerador localiza os arquivos por padrão de nome e usa sempre a versão mais alta;
o `git diff` do `web/data/anexo8.json` mostra exatamente o que mudou na correlação.
