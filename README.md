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
