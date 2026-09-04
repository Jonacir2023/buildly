# BUILDLy — briefing para continuar o projeto

Documento de passagem. Escrito em 04/09/2026 para quem for continuar o
trabalho — pessoa ou outra IA. Leia inteiro antes de escrever a primeira
linha: metade do que está aqui são erros já cometidos, e repetir sai caro.

**Dono:** Jonacir Cazelli, engenheiro civil, Cesbe S.A.
**O que é:** plataforma de gestão de obra, para uso em canteiro, no celular.
**Idioma:** português do Brasil em tudo — código, comentário, commit, tela.

---

## 1. Onde as coisas estão

| O quê | Onde |
|---|---|
| Aplicativo no ar | https://jonacir2023.github.io/buildly/ |
| Formulário público | https://jonacir2023.github.io/buildly/pedido.html?obra=CÓDIGO |
| Repositório | github.com/Jonacir2023/buildly (público, `main`, Pages na raiz) |
| Banco | Supabase, projeto **P3**, ref `ynmewxemcntafwoipybm` |
| URL do banco | https://ynmewxemcntafwoipybm.supabase.co |
| Chave publicável | `sb_publishable_53Hk4J6SwBA7yoXcMRV2Mw_Uj5ifQUv` |
| Login | `jonacir70@icloud.com` (a senha é só do dono) |

A chave publicável é pública **por desenho**. Quem protege o dado são as
políticas de acesso (RLS), não o segredo da chave: sem login, o banco
responde vazio. Nunca coloque a *service key* no repositório.

### Arquivos

```
buildly/
├── index.html     1.614 linhas — todas as telas e folhas
├── app.js         5.510 linhas — toda a lógica
├── estilo.css     1.109 linhas — paleta e desenho
├── pedido.html      121 linhas — formulário público, sem login
├── pedido.js         90 linhas
├── verificar.py      37 linhas — roda antes de cada envio
├── tests-dble.js               — dublê do Supabase, para teste de tela
├── CLAUDE.md                   — regras curtas, para IA ler primeiro
├── README.md                   — decisões técnicas por módulo
├── LEIA-ME.txt                 — manual do usuário, em linguagem de obra
└── .nojekyll                   — o Pages não deve reprocessar nada
```

Sem framework, sem build, sem `npm`. Três arquivos e pronto — porque o
dono não faz deploy: ele quer abrir o navegador e funcionar.

---

## 2. Regras do dono — não negociáveis

Estas custaram dias. Não são preferência de estilo.

**Português sempre.** A equipe é de canteiro.

**Nome de obra em teste, exemplo ou `placeholder` é só `TESTE`.** Nunca
nome de cliente real. Já causou confusão séria entre projetos diferentes:
"Suzano" apareceu num exemplo e ele achou que os dados tinham se
misturado com outro sistema.

**Este repositório não se liga a nenhum outro.** Nada de `Jonacir2023/JC`,
nada do repositório `diario-obras` (é de terceiro e não se mexe), nada de
planilha do Google. O que guarda dado é o Supabase P3 e mais nada.

**Nunca afirmar que algo está no ar sem ter verificado.** O ambiente de
desenvolvimento bloqueia `github.io`; quem confirma a publicação é o dono.
Dizer "está no ar" sem prova já aconteceu e custou dias de confusão.

**Nunca perder informação já digitada.** Telas longas gravam por parte, na
hora, sem botão de salvar no fim.

**Ele testa de verdade e cobra o que sumiu.** Quando um módulo é
reescrito, o que existia antes precisa continuar existindo. Já reclamou —
com razão — de kanban e de calendário que não foram refeitos.

---

## 3. Como o banco pensa

29 tabelas, 9 views, 11 funções, 9 gatilhos, 2 tarefas agendadas, 24
migrações aplicadas.

### Dado derivado mora no banco, nunca no app

Se o app calculasse, qualquer gravação por outro caminho (N8N, SQL,
importação) deixaria o número mentindo.

| Coluna | Quem mantém |
|---|---|
| `contratos.ativo` | calculada: `desligamento is null` |
| `contratos.fim_experiencia_1` | calculada: `admissao + 45` |
| `contratos.fim_experiencia_2` | calculada: `admissao + 90` |
| `nf_itens.total_item` | calculada: `round(quantidade * preco_unitario, 2)` |
| `contrato_itens.valor_total` | calculada: `round(quantidade * valor_unitario, 2)` |
| `nfs.total` | gatilho `nf_itens_recalcula` |
| `tarefas.concluido_em` | gatilho `tarefas_conclusao` |
| acumulado da medição | `vw_medicao_item`, janela sobre o número da medição |

**O app nunca escreve nessas colunas.** Mandar valor para coluna calculada
é erro na hora.

### As views expõem o CÓDIGO da obra, nunca o nome

`vw_efetivo`, `vw_alertas`, `vw_rdo_resumo`, `vw_chuva_mes`,
`vw_disponibilidade_equipamento`, `vw_ficha_epi` e `vw_contrato_saldo`
todas têm uma coluna `obra` que é `obras.codigo`.

Filtrar por nome devolve **lista vazia sem erro nenhum** — o pior tipo de
defeito. Sempre `_obra.codigo`.

Esse erro já foi cometido e passou despercebido porque, na obra de teste,
código e nome eram os dois "TESTE".

### Índices únicos que viram mensagem em português

Erro do banco chega em inglês falando de índice. Traduzir com o que fazer
a seguir é parte da entrega, não enfeite.

| Índice | O que o usuário lê |
|---|---|
| `uq_contrato_ativo` | já tem contrato ativo; dê baixa antes |
| `pessoas_cpf_key` | CPF já cadastrado para outra pessoa |
| `equipamentos_prefixo_key` | prefixo único **em todas as obras**, não só nesta |
| `uq_rdo_obra_data` | já existe diário desse dia; abre o que existe |
| `uq_rdo_obra_numero` | recalcula o número e tenta de novo |
| `uq_presenca` | uma linha por pessoa por diário |
| `uq_rdo_equip` | equipamento já lançado no dia |
| `uq_nf` | `nulls not distinct`: duas notas sem série também batem |
| `medicoes (contrato_id, numero)` | numeração sequencial por contrato |
| `reuniao_participantes (reuniao_id, nome)` | já está na lista |

### Numeração calculada pelo app

`rdos.numero` e `medicoes.numero` **não têm valor automático**. O app faz
`max+1` e, se o índice único recusar (dois aparelhos ao mesmo tempo), a
segunda tentativa recalcula em vez de estourar erro na cara do usuário.

### Baixa é lógica, nunca apagar

`contratos.desligamento`, `equipamentos.ativo`, `epis.ativo`,
`contratos_comerciais.ativo`. O banco tem `ON DELETE RESTRICT` nos
lugares certos: contrato com presença lançada, equipamento com horas em
RDO e contrato com ocorrência **não podem ser apagados**. É o que garante
que a baixa nunca apague história.

### Data é sempre no fuso da obra

`hojeISO()` usa `America/Sao_Paulo`, não o relógio do aparelho: celular
configurado errado não pode fazer o RDO cair no dia anterior.

Consequência para testes: perto da meia-noite UTC a data da máquina e a
da obra discordam, e a certa é a da obra. Já quebrou quatro verificações,
e o app estava certo.

### Acesso

Quase toda tabela tem uma política `auth_all` — quem tem login lê e
escreve tudo. Três exceções, e cada uma tem motivo:

- **`perfis`** — leitura para todos; escrita só para quem já é gestor,
  via `eh_gestor()`, que é `SECURITY DEFINER` para evitar recursão
  infinita na própria política. Um gatilho impede tirar o último gestor.
- **`avisos`** — leitura e marcar-como-lido. Ninguém insere pelo app.
- **`solicitacoes`** — `anon` tem **só INSERT**, com `with check` exigindo
  `status = 'pendente' and tarefa_id is null`. Anônimo não lê nada.

### O que roda sozinho (pg_cron)

| Quando | O quê |
|---|---|
| todo dia 09:00 UTC (06:00 SP) | `gerar_avisos()` |
| domingo 09:30 UTC | `limpar_avisos_antigos()` |

`gerar_avisos()` varre cinco frentes: experiência de 45 e 90 dias
vencendo em 7 dias, viagem prevista, tarefa fora do prazo, dia útil sem
RDO (domingo não conta) e EPI com troca vencida sem entrega posterior.

Índice único `(obra_id, tipo, referencia, data_ref)` com
`on conflict do nothing` — o robô roda toda manhã, e sem isso o mesmo
prazo viraria aviso novo todo dia.

---

## 4. Os módulos

Onze, todos funcionando. Nenhum "em construção".

| Módulo | O que faz | Tabelas |
|---|---|---|
| **RDO** | diário: calendário do mês, condições, DSS, chamada, atividades, equipamentos, fotos, PDF, resumo de chuva | `rdos`, `rdo_presencas`, `rdo_atividades`, `rdo_equipamentos`, `rdo_fotos` |
| **Efetivo** | pessoas e contratos, regime de moradia, baixa | `pessoas`, `contratos`, `funcoes` |
| **Alertas** | prazos até 60 dias (o painel mostra 7) | `vw_efetivo` |
| **EPI** | catálogo e ficha de entrega, troca prevista | `epis`, `epi_entregas` |
| **Ocorrências** | segurança e disciplina, 8 tipos, elogio incluído | `ocorrencias` |
| **Tarefas** | quadro (kanban) e lista, mais os pedidos recebidos | `tarefas`, `solicitacoes` |
| **Notas fiscais** | cabeçalho e itens, total pelo gatilho | `nfs`, `nf_itens` |
| **Equipamentos** | frota, alocação, disponibilidade do mês | `equipamentos` |
| **Medições** | contrato → itens → boletim mensal acumulado | `contratos_comerciais`, `contrato_itens`, `medicoes`, `medicao_itens` |
| **Reuniões** | ata, participantes, tópicos que viram tarefa | `reunioes`, `reuniao_*` |
| **Documentos** | links e mural | `documentos`, `mural`, `documento_notas` |

Fora dos módulos: **busca em toda a obra** (lupa no topo) e **avisos**
(sino no topo).

---

## 5. Decisões de desenho, e por quê

Não mude estas sem entender o motivo. Cada uma veio de uso real em obra.

**Sem botão de salvar nas telas longas.** RDO, nota fiscal e ata gravam
campo a campo, no `change` ou no `blur`. Um botão no fim de uma tela desse
tamanho perde o dia inteiro de apontamento quando o sinal cai no canteiro.

**Alvo de toque de 48px.** Dedo de luva não acerta alvo pequeno.

**Lista fechada, nunca texto livre**, onde o banco tem `check`. O seletor
existe para o dado nascer certo.

**Duas formas de mover o cartão no quadro.** Seta de um toque para o
canteiro, arrastar para o computador. Arrastar com luva, no sol, falha.

**O calendário mostra o dia que FALTA.** Lista só mostra o que existe, e o
buraco não aparece. Dia passado sem diário fica vermelho e clicável.

**Foto e documento guardam o link do Drive, não o arquivo.** Decisão do
dono: o diário não carrega arquivo pesado no celular da obra.

**PDF sem biblioteca.** `@media print` mais `window.print()`. No iPhone
vira Compartilhar → Salvar em Arquivos. Menos peça para quebrar.

**Pedido de formulário não vira tarefa sozinho.** Cai numa caixa de
entrada e alguém com login aceita, ajustando responsável e prazo.
Formulário aberto gravando na tabela de verdade é porta aberta.

**Elogio está entre os tipos de ocorrência.** Histórico de segurança que
só guarda o que deu errado vira punição, e aí ninguém reporta quase
acidente — que é o registro que evita o acidente seguinte.

**Cor nunca é a única informação.** No resumo de chuva e no calendário,
cada faixa tem número escrito, ordem fixa e legenda.

**Prefixo `p3::` em tudo que vai para o `localStorage`.** Os apps do dono
dividem a mesma origem (`jonacir2023.github.io`) e, sem prefixo,
dividiriam o mesmo armazenamento — dado de um aparecendo no outro. Isso já
aconteceu e foi a origem do projeto.

### Paleta e tipografia — escolha do dono, não mexer

```
--bg #F3EFE9   --surface #FFFFFF   --line #DFD7C9
--ink #2E2A26 (12,9:1)   --ink-soft #6E6459 (5,6:1)
--accent-text #9C4F1E (5,2:1)  ← texto e link
--accent      #A85822 (5,1:1)  ← fundo de botão
--accent-mark #B4622A (4,4:1)  ← marca e ícone, NUNCA com texto em cima
Semântica, separada da marca:
--ok #46703A   --warn #A8700E   --danger #A32E22   --info #2C5C73
Escuro: --bg #211E1B  --ink #EFE9E0  --accent-text #E09A5C
Fontes: Barlow (corpo) · Barlow Semi Condensed (título e rótulo)
        IBM Plex Mono (número, data, código)
```

Três ocres, e a diferença não é gosto: é contraste. O ocre de marca
reprova em texto pequeno, por isso só aparece em marca e ícone.

---

## 6. Como testar — obrigatório antes de qualquer envio

Duas frentes, sempre. Hoje são **365 verificações de tela** e 16 em SQL.

**1. SQL contra o banco real**, dentro de um bloco que se desfaz:

```sql
do $$
declare r text := '';
begin
  -- insere, altera, tenta violar constraint...
  raise exception 'RESULTADO >> %', r;   -- estoura e desfaz tudo
end $$;
```

É o que pega coluna calculada escrita por engano e constraint mal
entendida. **Confira as contagens antes e depois** — o dono já tem dados
reais no banco, e nada seu pode sobrar.

**2. Navegador**, com o dublê de Supabase em memória (`tests-dble.js`).
Ele imita índices únicos, checagens e valores padrão. Não substitui a
frente 1.

**3. `python3 verificar.py`** antes de todo envio. Confere o que o olho
não pega: id usado no JS que não existe no HTML, módulo marcado pronto sem
tela, tela sem carregador no roteador. Já pegou um botão que teria ido
morto para o ar.

**4. Olhe a tela renderizada.** Metade dos defeitos desta lista só
apareceu em captura de tela, não em teste.

---

## 7. Erros já cometidos — não repita

Estão aqui porque cada um custou tempo.

1. **Filtrar view pelo nome da obra em vez do código.** Passou
   despercebido porque na obra de teste os dois eram iguais.
2. **Supor o significado de uma coluna pelo nome.**
   `vw_status_obra.contratos_ativos` conta `contratos_comerciais` (a obra
   com o cliente), **não** contrato de trabalho. Para efetivo é
   `efetivo_ativo`.
3. **Usar função que ainda não existe numa migração.** Aconteceu duas
   vezes. O Postgres recusa a migração inteira — nada fica pela metade,
   mas é retrabalho. Crie a função no mesmo arquivo, antes da view.
4. **Editar código por busca de texto exato.** Um espaço a mais e a
   substituição falha **em silêncio**. Um módulo quase foi para o ar com
   o botão morto. Confirme que a substituição pegou.
5. **Colisão de nome de classe CSS.** `.num` é o quadro de número do
   painel; usei o mesmo nome numa célula de tabela impressa e os números
   saíram dentro de cápsulas arredondadas no PDF.
6. **`document.elementFromPoint` devolve `null` fora da viewport.** No
   celular a coluna de destino do kanban quase sempre está fora, porque o
   quadro rola na horizontal. Sem tratar, arrastar no celular é
   impossível.
7. **`generate_series` com datas devolve `timestamp`**, e a subtração
   vira `interval`. Conte em número de dias.
8. **Faixa de cor que a fonte de dados nunca produz.** `vw_alertas` só
   devolve até 7 dias; as faixas de 15 dias que escrevi nunca acendiam.
9. **Testes comparando com o relógio da máquina** em vez do fuso da obra.
10. **Concatenar HTML com texto vindo do banco.** Nome de fornecedor com
    `<` vira tag. Use `createElement` e `textContent`.
11. **Ler pela view e nunca escrever na tabela.** O regime "ajuda de
    custo" era mostrado e contado, mas o app não tinha como criar —
    ficaria em zero para sempre. Ao usar uma view, confira se existe
    caminho para gravar o que ela lê.
12. **Aviso automático sem marco inicial.** O robô avisava "sem RDO"
    nos 7 dias anteriores assim que a obra tivesse qualquer diário, e
    a obra que começou ontem levou uma semana de alarme falso. Todo
    aviso retroativo precisa de um marco: nada antes do primeiro
    lançamento.
13. **Comparar texto de botão diferenciando maiúscula** no teste. O CSS
    põe em versalete.
14. **Reusar nome de classe do CSS como modificador.** Três vezes:
    `.num` e `.aviso` trouxeram fundo, borda e espaçamento junto.
    Modificador leva prefixo próprio. O `verificar.py` já checa.
15. **`pg.evaluate` do Playwright executa a função que o trecho
    devolve.** Substituir `window.print` por uma função contadora já
    conta uma chamada. Zere o contador depois de instalar.

---

## 8. O que ainda não existe

- **O aviso não chega ao celular sozinho.** Fica no app, no sino. Sair por
  e-mail ou WhatsApp exige serviço externo com chave paga, que o dono
  precisa contratar (Resend é o mais barato para e-mail).
- **Uma obra só.** O app já troca de obra, mas nunca foi usado com duas.
- **Sem importação de dados.** A planilha antiga foi zerada; o banco
  começou limpo, de propósito.
- **Sem foto dentro do app.** Só link do Drive.
- **`documento_notas` e `reuniao_pauta`** têm tabela mas pouca ou
  nenhuma tela. (`ajuda_custo` já tem tela, dentro da ficha da pessoa.)
- **Sem relatório consolidado** além do PDF do RDO: não há medição em PDF
  nem folha de efetivo para impressão.

---

## 9. Estado real dos dados (04/09/2026)

O dono já está usando. Não é banco vazio.

- 1 obra: `TESTE`
- 2 pessoas com contrato: Jonacir Cazelli (Engenheiro) e João Da Silva (Pedreiro)
- 1 RDO lançado (03/09) com 1 presença e 1 atividade
- 1 tarefa
- 1 perfil: Jonacir Cazelli, papel `gestor`

**Todo teste destrutivo tem que ser desfeito.** Confira as contagens
depois.

---

## 10. Se você for uma IA continuando isto

Leia `CLAUDE.md` no repositório antes de tudo — é a versão curta destas
regras, e é o que o dono espera que seja seguido.

O que ele valoriza, pelo que demonstrou ao longo do trabalho:

- **Que você diga o que errou.** Ele confia mais em quem aponta o próprio
  defeito do que em quem entrega tudo perfeito.
- **Que você verifique em vez de supor.** Ele já foi enganado por
  "está no ar" sem prova.
- **Que você explique a decisão, não só o resultado.** Ele é engenheiro:
  quer saber por que a conta mora no banco e não no app.
- **Que você não invente dado.** Tela vazia diz que está vazia; número
  sem base não aparece.
- **Passo a passo.** Ele testa cada entrega antes da seguinte, e prefere
  assim.
