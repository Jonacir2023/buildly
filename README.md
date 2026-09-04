# BUILDLy

Plataforma de gestão de obra. Banco: Supabase (projeto P3).
Publicada pelo GitHub Pages a partir da raiz deste repositório.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Entrar, painel da obra, escolher obra, cadastrar obra |
| `estilo.css` | Paleta Terra (claro e escuro) e todo o desenho |
| `app.js` | Consultas ao Supabase e a lógica da tela |
| `.nojekyll` | Impede o GitHub de reprocessar os arquivos |

## Publicar

Settings → Pages → Source: **Deploy from a branch** → `main` / `(root)`.

Endereço: <https://jonacir2023.github.io/buildly/>

## A chave do Supabase é pública de propósito

A chave em `app.js` é a *publishable key*. Quem protege o dado são as
políticas de acesso (RLS) do banco, não o segredo da chave: sem login, o
banco responde vazio. Senha nenhuma fica no código.

## Isolamento

Tudo que o app guarda no navegador leva o prefixo `p3::`. Os apps ficam na
mesma origem (`jonacir2023.github.io`) e, sem prefixo, dividiriam o mesmo
armazenamento — dado de um aparecendo no outro.

## O painel

Uma consulta a `vw_status_obra` traz a obra inteira; uma segunda pergunta
se o RDO de **hoje** já existe (`dias_sem_rdo` não serve: no primeiro dia
da obra ele vem vazio, e vazio não é atraso). `vw_alertas` traz os prazos
de experiência e viagem já com os dias restantes.

## Cadastro

Aba que reúne o que se cadastra uma vez e depois só se escolhe: **Efetivo**,
**EPI**, **Equipamentos** e **Atividades**. As três telas continuam inteiras; saíram
do trilho de módulos (`MODULOS`) e passaram a ser abertas por dentro do
Cadastro (`CADASTROS`). Voltando de qualquer uma delas, o roteador cai no
Cadastro, e o trilho acende o Cadastro enquanto se está lá dentro.

`verificar.py` confere `CADASTROS` com o mesmo rigor de `MODULOS` — tela
existente, escondida pelo roteador, com carregador — e confere também que
todo ícone citado existe no desenho. Sem isso, tela tirada do trilho
deixaria de ser conferida.

## Atividades

`atividades` é o catálogo por obra: `descricao`, `local`, `unidade`,
`ativo`. O índice `uq_atividade_obra_desc` compara
`lower(btrim(descricao))`, então grafia diferente do mesmo serviço é
recusada em vez de partir o acumulado em dois.

Baixa é lógica (`ativo = false`): os diários antigos apontam para a
atividade, e apagar quebraria o histórico.

`vw_atividade_acumulado` soma `rdo_atividades.quantidade` por atividade e
conta os dias lançados. **O aplicativo não soma nada disso** — dois
apontadores lançando no mesmo dia fariam a conta do aplicativo mentir para
os dois.

| Regra do banco | O que o usuário lê |
|---|---|
| `uq_atividade_obra_desc` | já está cadastrada; veja o bloco "fora de uso" |
| `uq_rdo_atividade` | a mesma atividade não entra duas vezes no mesmo dia |
| `quantidade >= 0` | barrado na tela antes de mandar |

## Efetivo

Lista de `vw_efetivo` filtrada pelo **código** da obra — a view expõe
`o.codigo` em `obra`, não o nome. Cadastro e edição vão direto em
`pessoas` e `contratos`, porque a view não devolve os id.

Três colunas de `contratos` são calculadas pelo banco e o app nunca as
escreve: `ativo` (`desligamento is null`), `fim_experiencia_1`
(`admissao + 45`) e `fim_experiencia_2` (`admissao + 90`).

Regras que viram mensagem em português em vez de erro cru:

| Regra do banco | O que o usuário lê |
|---|---|
| `uq_contrato_ativo` | já tem contrato ativo; dê baixa antes |
| `pessoas_cpf_key` | CPF já cadastrado para outra pessoa |
| `chk_desligamento` | baixa não pode ser antes da admissão |

Baixa é lógica: grava `desligamento` e `motivo_desligamento`, some do
efetivo e aparece em "Desligados". Nada é apagado.

`epi_funcao` (`epi_id`, `funcao_id`, chave primária nos dois) diz qual EPI
cada função exige, com `on delete cascade` dos dois lados. A ficha da
pessoa usa isso para separar exigido de opcional; salvar o EPI troca a
lista inteira de vínculos (apaga e regrava), que dá o mesmo resultado de
comparar diferença com menos chance de errar.

O catálogo `epis` **não tem `obra_id`**: é comum a todas as obras, porque
capacete é capacete em qualquer canteiro e o CA é nacional. Por isso
`vw_status_obra.epis_no_catalogo` conta sem filtrar por obra.

**EPI entra junto do cadastro da pessoa.** Numa pessoa nova, o catálogo de
EPI ativo aparece em caixas no pé da ficha; o que for marcado vira
`epi_entregas` com `data_entrega = admissao`, `motivo = 'primeira_entrega'`
e `assinatura_ok = false`, gravado depois do `contratos.insert(...)
.select('id')`. Se essa gravação falhar, a pessoa **não** se perde: ela já
está cadastrada e o aviso diz o que ficou faltando lançar.

Numa pessoa já cadastrada, o mesmo lugar mostra o histórico com a troca
prevista e abre a ficha de entrega com o contrato já escolhido e o seletor
travado.

A ficha de entrega escolhe **vários EPI de uma vez**: a mesma
`listaDeEpis()` da admissão, e o submit faz um `insert` com o vetor das
linhas — mesma data, motivo, quantidade e assinatura para todas. Trocar
de pessoa limpa as marcas, porque é outra entrega. O motivo **não** muda
sozinho para "troca" como antes: com vários itens, ele mentiria para os
que a pessoa nunca recebeu; a tela avisa quais são repetição e quem
entrega decide.

`vw_efetivo` passou a expor `funcao_id` para essa lista poder separar o
exigido do opcional — casar por nome de função quebraria calado no dia em
que alguém renomeasse uma.

## RDO

Grava por parte, sem botão de salvar: campo do cabeçalho grava no
`change`/`blur`, presença grava a cada alteração, atividade e foto
gravam ao confirmar a folha.

`rdos.numero` não tem valor automático no banco — o app calcula
`max(numero)+1` por obra. Se `uq_rdo_obra_numero` recusar (dois
aparelhos ao mesmo tempo), a segunda tentativa recalcula.

Ao criar, semeia `rdo_presencas` com quem tinha contrato ativo **naquele
dia** — `admissao <= data and (desligamento is null or desligamento >=
data)` — e não com o efetivo de hoje.

| Regra do banco | O que o usuário lê |
|---|---|
| `uq_rdo_obra_data` | já existe diário desse dia; abre o que existe |
| `uq_presenca` | uma linha por pessoa por diário |
| `uq_rdo_equip` | equipamento já lançado no dia; edite o lançamento |
| `situacao` in (…) | lista fechada no seletor, nunca texto livre |
| `percentual 0..100` | barrado na tela antes de mandar |

As atividades do dia saem do catálogo (botão "Da lista") ou de texto livre
(botão "+ Avulsa"). Escolhendo do catálogo, `rdo_atividades` recebe uma
**cópia** de `descricao`, `local` e `unidade`, mais o vínculo
`atividade_id`. A cópia é o que faz o diário continuar verdadeiro depois
que o cadastro mudar; o vínculo é o que faz o acumulado somar. Por isso a
descrição de uma linha vinda do catálogo é somente leitura dentro do
diário.

Desmarcar na folha de escolha uma atividade que já tem `quantidade` ou
`percentual_executado` é recusado: a marca volta e a tela manda apagar
pela linha do diário. O app não tem `confirm()` em lugar nenhum — perder
o que já foi digitado por um toque errado não é opção que se ofereça.

Os equipamentos do dia seguem o mesmo desenho: "Da lista" marca as
máquinas da frota e cria a linha com zero hora; "+ Um a um" abre a folha
com máquina e horas juntas. Desmarcar máquina com hora lançada é recusado
do mesmo jeito.

`vw_rdo_resumo` e `vw_efetivo` expõem `o.codigo` em `obra` — todas as
consultas filtram pelo código, nunca pelo nome.

## Equipamentos

`equipamentos.prefixo` é **UNIQUE global**, não por obra — a mensagem de
erro diz isso, senão o usuário procuraria o conflito só dentro da obra.
`obra_id` é anulável: existe frota não alocada, e só a alocada aparece no
seletor do RDO.

`vw_disponibilidade_equipamento` calcula `operando / (operando + paradas)`
por prefixo e mês, a partir de `rdo_equipamentos`. A tela mostra o mês
corrente; sem horas lançadas não mostra nada em vez de mostrar zero.

Baixa é lógica (`ativo = false`). O banco recusa apagar equipamento com
lançamento em RDO (`ON DELETE RESTRICT`).

| Regra do banco | O que o usuário lê |
|---|---|
| `equipamentos_prefixo_key` | prefixo único em todas as obras |
| `categoria` in (…) | seletor fechado: pesado, leve, apoio, ferramenta |
| `propriedade` in (…) | seletor fechado: próprio, locado |

## Ocorrências

`ocorrencias` **não tem `obra_id`**: pertence à obra através do contrato
ou do RDO. Por isso a tela faz duas consultas e junta —
`contratos!inner` filtrado por `contrato.obra_id`, e `rdos!inner`
filtrado por `rdo.obra_id` com `contrato_id is null`.

`chk_ocorrencia_vinculo` exige `contrato_id` **ou** `rdo_id`. A tela
pergunta o vínculo primeiro e, quando é "a obra", confere se existe RDO
naquele dia antes de deixar salvar.

| Regra do banco | O que o usuário lê |
|---|---|
| `chk_ocorrencia_vinculo` | precisa de uma pessoa ou de um dia com RDO |
| `ocorrencias_tipo_check` | seletor fechado de 8 tipos, elogio incluído |
| `ocorrencias_gravidade_check` | seletor fechado: baixa, média, alta, crítica |
| FK `contrato_id` RESTRICT | contrato com ocorrência não se apaga |

### Correção na vw_status_obra

`ocorrencias_30_dias` fazia `JOIN contratos`, então ocorrência ligada só
ao RDO nunca era contada — justamente o registro sem pessoa
identificada, como quase acidente da obra. A view passou a contar os
dois vínculos.

## Quadro de tarefas

Colunas por `status`. A vista escolhida fica em `localStorage` sob
`p3::tf-vista`.

Mover é possível de duas formas de propósito: a seta de um toque (o
caminho do canteiro — arrastar com luva ao sol falha) e o arrasto por
Pointer Events, não HTML5 drag-and-drop, que não funciona em toque.

O arrasto só começa depois de 8 px de movimento: sem isso, um toque
tremido no cartão viraria arrasto e ninguém abriria a tarefa.

Duas correções que o teste de arrasto revelou:
`document.elementFromPoint` devolve `null` fora da viewport, e no
celular a coluna de destino costuma estar fora — o ponto é trazido para
dentro da borda antes de perguntar o que está embaixo, e o `.kanban`
rola sozinho quando o ponteiro chega perto da borda.

`concluido_em` continua vindo do gatilho: mover para Concluída no quadro
não escreve a data pelo app.

## Ajuda de custo

Estava faltando: o app lia o regime `ajuda_moradia` pela `vw_efetivo`,
mostrava e contava — mas nunca escrevia em `ajuda_custo`. O quadro
ficaria em zero para sempre.

`uq_ajuda_ativa` (parcial, `where fim is null`) permite **uma** ajuda
aberta por contrato; `chk_periodo` exige `fim >= inicio`. Ambos viram
mensagem em português.

Na `vw_efetivo`, ajuda tem prioridade sobre alojamento e **zera
`proxima_viagem`**. A tela avisa disso ao conceder e ao encerrar — é
consequência que não está à vista.

## Robô de avisos

`gerar_avisos()` roda por `pg_cron` às 09:00 UTC (06:00 em São Paulo) e
grava em `avisos`. A varredura mora no banco porque o aviso precisa
existir mesmo que ninguém abra o app.

`uq_aviso (obra_id, tipo, referencia, data_ref)` com `on conflict do
nothing`: o robô roda todo dia, e sem essa chave o mesmo prazo viraria
aviso novo a cada manhã.

O aviso de "sem RDO" só olha dias **iguais ou posteriores ao primeiro
diário da obra**. Sem isso, obra que lança o primeiro RDO hoje recebe
uma semana de alarme falso — aconteceu de verdade na primeira rodada.

`limpar_avisos_antigos()` roda aos domingos e apaga só o que foi lido há
mais de 60 dias. Não lido nunca é apagado.

Entrega fora do app (e-mail, WhatsApp) **não existe** — exige serviço
externo com chave, que o dono precisa contratar.

## Pedidos por formulário

`pedido.html` é público e usa a mesma chave publicável. A política de
`solicitacoes` dá ao papel `anon` **só INSERT**, e ainda exige `status =
'pendente' and tarefa_id is null` no `with check`. Anon não lê nada.

O formulário manda o **código** da obra; um trigger `security definer`
resolve para `obra_id`. Assim o anônimo nunca precisa ler `obras`.

O insert é feito **sem `.select()`**: pedir retorno exigiria permissão de
leitura, que essa página não tem nem deve ter.

Limites de tamanho por `check` na tabela, e campo-isca invisível no
formulário — preenchido, o envio é descartado em silêncio.

## Busca em toda a obra

Dez consultas em paralelo com `ilike` no PostgREST, uma por tabela, com
300 ms de espera depois da última tecla — dez consultas por tecla
derrubariam a conexão de canteiro.

O termo é limpo antes de entrar no filtro `or(...)`: vírgula e parêntese
quebram a sintaxe do PostgREST. O realce do trecho encontrado é montado
com `document.createElement`, nunca por concatenação de HTML — nome de
fornecedor com `<` viraria tag.

## PDF do diário

Sem biblioteca: uma folha `#folha-impressao` montada no DOM e
`window.print()`. Menos peça para quebrar, e sai igual em qualquer
aparelho — no iPhone é Compartilhar > Salvar em Arquivos.

Toda a folha vive dentro de `@media print`; fora dela é `display:none`.
As partes são relidas do banco na hora de montar: a folha tem que sair
com o que está gravado, não com o que sobrou na memória da tela.

Atenção a nome de classe: `.num` já é o quadro de número do painel, e a
célula numérica da tabela impressa herdava fundo e raio dele. Por isso a
classe da impressão é `.imp-n`.

## Relatórios

`vw_rdo_dia` dá uma linha por diário com presentes, faltas, atestados,
homem-hora, horas extras, atividades, fotos e horas de equipamento.
Existe para o app não baixar `rdo_presencas` de um ano inteiro (365 dias
× 20 pessoas) só para somar faltas.

O total do período é soma simples dessas linhas, feita na tela — isso é
apresentação. A derivação de dado está na view.

Período: semana (segunda a domingo), mês ou ano, com deslocamento para
trás. Dia útil é segunda a sábado; domingo não conta como dia sem
diário.

Os três PDF (diários, chuva, medição) usam as mesmas peças do diário:
`cabecalhoImp`, `secaoImp`, `campoImp`, `tabelaImp`, `assinaturasImp`,
`rodapeImp`. Quem recebe reconhece o documento.

O boletim de medição sai em paisagem via `@page paisagem` mais a classe
`.imp-paisagem` na folha; as outras folhas limpam a classe antes de
montar.

### Código de verificação

`emitirFolha(tipo, referencia, resumo, nomeArquivo)` fecha toda folha
impressa: calcula o SHA-256 do `textContent` da folha (espaço e quebra de
linha normalizados) com `crypto.subtle`, grava em `emissoes` e escreve no
rodapé os 12 primeiros hex do hash como `XXXX-XXXX-XXXX`. Só então chama
a impressão. Se não houver `crypto.subtle` (contexto sem https) ou o
insert falhar, o rodapé diz "emitido sem registro de verificação" — código
sem registro atrás não verifica nada.

`emissoes` guarda `tipo` (lista fechada), `referencia`, `resumo` (jsonb
com os números do papel), `hash` (check de 64 hex), `emitido_em` e
`emitido_por`. `uq_emissao_codigo` é único sobre `left(hash, 12)`: o
banco recusa colisão de código em vez de o app fingir que não viu.

A busca reconhece um termo só hexadecimal de 6 a 12 caracteres (com ou
sem traços) e consulta `emissoes` por prefixo do hash, mostrando o registro
como cartão fixo (não é botão: não leva a lugar nenhum, é para conferir).

### Custos · previsto × realizado

`vw_lancamento_financeiro` dá uma linha por dinheiro com data: medição de
cliente (`medicao_receber`), medição de empreiteiro (`medicao_pagar`) e
nota fiscal (`nota_fiscal`), com `valor` somado no banco. Medição sem item
entra com zero, não some. `vw_contrato_saldo` continua sendo a fonte do
contratado × medido por contrato.

O app lê os lançamentos da obra **até o fim do período, sem começo** —
a curva de acumulado precisa do que veio antes da janela — e filtra o
período na tela. A curva é um SVG desenhado à mão (polyline), sem
biblioteca, doze meses, medido acumulado do cliente contra o total
contratado. Não há previsto por mês porque não há cronograma cadastrado;
a linha tracejada é o total do contrato.

Os valores grandes nos quadros saem em "R$ 38 mil" / "R$ 1,2 mi"
(`reaisCurto`), sem decimal na casa do milhar — com decimal quebrava em
duas linhas no celular.

## Calendário do RDO

Grade do mês em `tela-rdo`, acima da lista. Consulta `rdos` por
`obra_id` e intervalo do mês (`gte`/`lte`), não a view — precisa de
`condicao_trabalho`, que `vw_rdo_resumo` não expõe.

Três estados: dia com diário (abre para edição), dia passado sem diário
(abre a folha do novo RDO já com aquela data), dia futuro (desabilitado).
O botão de avançar trava no mês corrente.

O dia sem diário é a informação principal da tela — a lista mostra só o
que existe, então o buraco não aparece nela.

## Chuva e paralisação

`vw_chuva_mes` agrupa `rdos` por obra e mês. A classificação de chuva usa
`public.e_chuva(text)`, que normaliza caixa e acento por regex — o clima
é texto livre na tabela e precisa aguentar valor vindo por outro caminho.

`dias_perdidos = impraticável + 0,5 × parcialmente impraticável`, que é a
convenção do pleito de prorrogação de prazo.

A tela não recalcula nada: desenha o que a view devolve.

O encode das faixas é de **estado ordinal** (praticável → parcial →
impraticável), não categórico — daí ordem fixa, número escrito em cada
faixa e legenda, para a cor nunca ser a única informação.

## Ainda não pronto

Os outros módulos estão desabilitados e marcados "em construção" — a
tabela existe no banco, a tela ainda não. A próxima é o RDO.
