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
`uq_rdo_obra_numero`, `uq_presenca`, `uq_rdo_equip`,
`uq_atividade_obra_desc`, `uq_rdo_atividade`.

`uq_atividade_obra_desc` compara **sem caixa e sem espaço nas pontas**
(`lower(btrim(descricao))`): "Concretagem" e " concretagem " são a mesma
atividade, e duas grafias partiriam o acumulado em dois.

Tudo que o app guarda no navegador leva o prefixo **`p3::`**. Os apps do
usuário dividem a mesma origem (`jonacir2023.github.io`) e sem prefixo
dividiriam o mesmo armazenamento.

## Como as abas são organizadas

O trilho de módulos é a operação do dia. **Cadastro** é a aba que junta o
que se cadastra uma vez e depois só se escolhe: **Efetivo**, **EPI**,
**Equipamentos** e **Atividades**. Essas três telas continuam existindo
inteiras — só saíram do trilho principal e passaram a ser abertas por
dentro do Cadastro (`const CADASTROS` no `app.js`). O botão voltar, de
dentro delas, cai no Cadastro, não no painel, e o trilho acende o
Cadastro enquanto se está lá dentro.

O `verificar.py` confere `CADASTROS` com o mesmo rigor de `MODULOS`:
tela existente, escondida pelo roteador e com carregador. Sem isso, tela
tirada do trilho deixaria de ser conferida.

## O diário não digita nome de nada

Efetivo, equipamentos e atividades entram no RDO por escolha, nunca por
digitação. No caso da atividade, o que vai para `rdo_atividades` é uma
**cópia** — `descricao`, `local` e `unidade` — mais o vínculo
`atividade_id`. Mexer no cadastro amanhã não pode reescrever o diário
que a obra assinou ontem; o vínculo serve só para somar o acumulado
(`vw_atividade_acumulado`).

Atividade sai de uso por `ativo = false`, nunca por `delete`: os diários
antigos apontam para ela.

## EPI é do cadastro, e conhece a função

`epi_funcao` liga cada EPI às funções que o exigem. Na admissão, a ficha
da pessoa separa "Exigidos para {função}" do resto do catálogo e oferece
marcar todos de uma vez — mas **nunca marca sozinha**: entrega registrada
é entrega feita, e o app não pode afirmar que o capacete saiu do
almoxarifado.

O catálogo `epis` é comum a todas as obras (sem `obra_id`): capacete é
capacete em qualquer canteiro, e o CA é nacional.

A entrega marca **vários EPI de uma vez** (uma linha de `epi_entregas`
por item, mesma data e motivo). Por isso o motivo não vira "troca"
sozinho: com quatro itens marcados, ele mentiria para os três que a
pessoa nunca recebeu. A tela avisa quais são repetição e quem entrega
decide.

`vw_efetivo` expõe `funcao_id` além do nome da função — é o que a lista
de EPI usa para separar exigido de opcional.

## Todo PDF passa por `emitirFolha()`

Nenhuma folha chama `imprimirFolha()`/`window.print()` direto: passa por
`emitirFolha(tipo, referencia, resumo, nome)`, que grava a impressão
digital em `emissoes` e escreve o código no rodapé. Folha nova segue o
mesmo caminho, com um `tipo` novo na lista fechada da tabela (e no dublê).

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
| valor de cada medição e nota, com data | `vw_lancamento_financeiro` |
| contratado × medido por contrato | `vw_contrato_saldo` |

## Data é sempre no fuso da obra

`hojeISO()` usa `America/Sao_Paulo`, não o relógio do aparelho: celular
configurado errado não pode fazer o RDO cair no dia anterior.

Consequência para os testes: perto da meia-noite UTC a data da máquina e
a da obra discordam, e a certa é a da obra. Os testes calculam "hoje"
com `ZoneInfo('America/Sao_Paulo')` — já quebraram uma vez por não fazer
isso, e o app estava certo.

## O que roda sozinho

| Quando | O quê |
|---|---|
| todo dia 09:00 UTC | `gerar_avisos()` — varre prazos e grava em `avisos` |
| domingo 09:30 UTC | `limpar_avisos_antigos()` — apaga lido com mais de 60 dias |

Agendado por `pg_cron`. Ver com `select * from cron.job`.

## Escrita por quem não tem login

Só `solicitacoes` aceita `anon`, e só INSERT. Qualquer tabela nova que
precise receber de fora segue o mesmo desenho: caixa de entrada
separada, triagem por quem tem login, nunca gravação direta na tabela de
verdade.

## Como testar antes de entregar

Duas frentes, sempre, antes de qualquer `push`:

1. **SQL contra o banco real**, dentro de um bloco `do $$ ... $$` que
   termina com `raise exception` para desfazer tudo. É o que pega coluna
   calculada escrita por engano e constraint mal entendida. Conferir depois
   que as contagens voltaram ao que eram.
2. **Navegador**, com o dublê do Supabase em memória. O dublê imita os
   índices únicos e as checagens; ele não substitui a frente 1.

**Nome de classe CSS colide.** Já aconteceu três vezes: `.num` (quadro
de número do painel) numa célula de tabela impressa, e `.aviso` (caixa
de mensagem) como modificador de número. Modificador de classe leva
prefixo próprio — `qto-vermelho`, `imp-n`. O `verificar.py` agora
reclama disso sozinho.

**Id repetido no HTML.** `$()` devolve o primeiro e a segunda tela fica
muda, sem erro nenhum. Aconteceu com `at-titulo`, disputado pela ata da
reunião e pela tela de atividades. O `verificar.py` agora conta os id e
reclama do que aparece duas vezes.

**`limparTermo()` não abaixa a caixa.** Ela só tira o que atrapalha o
PostgREST, para a busca que vai ao banco. Filtro que roda na memória
compara com `.toLowerCase()` dos dois lados, como no efetivo e na frota
— usar `limparTermo` numa busca local faz "concret" não achar
"Concretagem".

Texto de botão e de rótulo é posto em versalete pelo CSS
(`text-transform: uppercase`). Teste que compara esse texto precisa
comparar sem diferenciar caixa — já quebrou verificações três vezes.

Erro que o banco devolve chega em inglês e falando de índice. Traduzir para
português com o que fazer a seguir é parte da entrega, não enfeite.
