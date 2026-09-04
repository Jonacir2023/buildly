# BUILDLy — como trabalhar neste repositório

Plataforma de gestão de obra do Jonacir Cazelli. Banco: Supabase, projeto
**P3** (`ynmewxemcntafwoipybm`). Publicado pelo GitHub Pages a partir da raiz.

## Regras do dono

**Português sempre** — código, comentários, mensagens de commit, texto de
tela. O usuário é engenheiro civil brasileiro e a equipe é de canteiro.

**Nome de obra em teste e exemplo é só `TESTE`.** Nunca usar nome de
cliente real, nem de obra real, nem em dado de teste, nem em `placeholder`,
nem em captura de tela. Cliente real aparecendo em exemplo já causou
confusão entre projetos diferentes.

**Este repositório não se liga a nenhum outro.** Nada de `Jonacir2023/JC`,
nada do repositório `diario-obras` (é de terceiro e não se mexe), nada de
planilha do Google. O que guarda dado é o Supabase P3 e mais nada.

**Nunca afirmar que algo está no ar sem ter verificado.** O proxy desta
caixa bloqueia `github.io`, então quem confirma a publicação é o usuário.
Dizer "está no ar" sem prova já aconteceu e custou dias.

**Nunca perder informação já digitada.** Telas longas gravam por parte, na
hora, sem botão de salvar no fim.

## Regras técnicas que o banco impõe

Colunas **calculadas** — o app nunca escreve nelas:

| Tabela | Coluna | Regra |
|---|---|---|
| `contratos` | `ativo` | `desligamento is null` |
| `contratos` | `fim_experiencia_1` | `admissao + 45` |
| `contratos` | `fim_experiencia_2` | `admissao + 90` |

As views expõem o **código** da obra na coluna `obra`, nunca o nome —
`vw_efetivo`, `vw_alertas` e `vw_rdo_resumo`. Filtrar por nome devolve
lista vazia sem erro nenhum. Sempre `_obra.codigo`.

`ocorrencias` **não tem `obra_id`** — pertence à obra pelo contrato ou
pelo RDO, e `chk_ocorrencia_vinculo` exige um dos dois.

`vw_status_obra.contratos_ativos` conta **`contratos_comerciais`** (a
obra com o cliente), **não** contrato de trabalho. Quem quer efetivo usa
`efetivo_ativo`. Já errei isso uma vez lendo o nome da coluna e supondo.

`rdos.numero` **não tem valor automático**: o app calcula `max+1` por obra
e trata a recusa do índice único recalculando.

Índices únicos que viram mensagem em português, nunca erro cru:
`uq_contrato_ativo`, `pessoas_cpf_key`, `uq_rdo_obra_data`,
`uq_rdo_obra_numero`, `uq_presenca`, `uq_rdo_equip`.

Tudo que o app guarda no navegador leva o prefixo **`p3::`**. Os apps do
usuário dividem a mesma origem (`jonacir2023.github.io`) e sem prefixo
dividiriam o mesmo armazenamento.

## Dado derivado mora no banco

Nenhum total é somado pelo app. Se o app somasse, qualquer gravação por
outro caminho (N8N, SQL, importação) deixaria o número mentindo.

| Coluna | Quem mantém |
|---|---|
| `nfs.total` | gatilho `nf_itens_recalcula` |
| `nf_itens.total_item` | coluna calculada |
| `contrato_itens.valor_total` | coluna calculada |
| `tarefas.concluido_em` | gatilho `tarefas_conclusao` |
| acumulado da medição | `vw_medicao_item`, com janela sobre o número |

## Data é sempre no fuso da obra

`hojeISO()` usa `America/Sao_Paulo`, não o relógio do aparelho: celular
configurado errado não pode fazer o RDO cair no dia anterior.

Consequência para os testes: perto da meia-noite UTC a data da máquina e
a da obra discordam, e a certa é a da obra. Os testes calculam "hoje"
com `ZoneInfo('America/Sao_Paulo')` — já quebraram uma vez por não fazer
isso, e o app estava certo.

## Como testar antes de entregar

Duas frentes, sempre, antes de qualquer `push`:

1. **SQL contra o banco real**, dentro de um bloco `do $$ ... $$` que
   termina com `raise exception` para desfazer tudo. É o que pega coluna
   calculada escrita por engano e constraint mal entendida. Conferir depois
   que as contagens voltaram ao que eram.
2. **Navegador**, com o dublê do Supabase em memória. O dublê imita os
   índices únicos e as checagens; ele não substitui a frente 1.

Erro que o banco devolve chega em inglês e falando de índice. Traduzir para
português com o que fazer a seguir é parte da entrega, não enfeite.
