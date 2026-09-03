/* ============================================================
   BUILDLy — entrar e painel da obra
   Banco: Supabase P3.

   A chave abaixo é pública por desenho. Quem protege o dado são
   as políticas de acesso do banco, não o segredo da chave: sem
   login, o banco responde vazio. Senha nenhuma entra aqui.
   ============================================================ */

const SUPABASE_URL = 'https://ynmewxemcntafwoipybm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_53Hk4J6SwBA7yoXcMRV2Mw_Uj5ifQUv';

/* Prefixo em tudo que o app guarda no navegador. Os apps do usuário
   dividem a mesma origem (jonacir2023.github.io) e, sem prefixo,
   dividiriam o mesmo pote — obra de um aparecendo no outro. */
const PREFIXO = 'p3::';
const guardar = (k, v) => { try { localStorage.setItem(PREFIXO + k, v); } catch (e) {} };
const ler     = (k)    => { try { return localStorage.getItem(PREFIXO + k); } catch (e) { return null; } };

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $  = (id) => document.getElementById(id);

const PAPEIS = {
  gestor: 'Gestor', engenheiro: 'Engenheiro', encarregado: 'Encarregado',
  apontador: 'Apontador', administrativo: 'Administrativo'
};

/* Os módulos que existem no banco. "pronto: false" é honesto: a tabela
   está lá, a tela ainda não. Melhor do que um botão que não faz nada.
   "conta" diz de qual número da obra o módulo tira o contador. */
const MODULOS = [
  { ic: 'i-rdo',        nome: 'RDO',           desc: 'Diário de obra',      pronto: true, tela: 'rdo', conta: 'rdos_30_dias' },
  { ic: 'i-efetivo',    nome: 'Efetivo',       desc: 'Pessoas e contratos', pronto: true, tela: 'efetivo', conta: 'efetivo_ativo' },
  { ic: 'i-alerta',     nome: 'Alertas',       desc: 'Experiência e viagem', pronto: false },
  { ic: 'i-epi',        nome: 'EPI',           desc: 'Ficha de entrega',    pronto: false },
  { ic: 'i-ocorrencia', nome: 'Ocorrências',   desc: 'Segurança',           pronto: false, conta: 'ocorrencias_30_dias' },
  { ic: 'i-tarefa',     nome: 'Tarefas',       desc: 'Pauta e prazo',       pronto: false, conta: 'tarefas_abertas' },
  { ic: 'i-nf',         nome: 'Notas fiscais', desc: 'Cabeçalho e itens',   pronto: false },
  { ic: 'i-equip',      nome: 'Equipamentos',  desc: 'Frota e horas',       pronto: false, conta: 'equipamentos_ativos' },
  { ic: 'i-medicao',    nome: 'Medições',      desc: 'Boletim e acumulado', pronto: false },
  { ic: 'i-reuniao',    nome: 'Reuniões',      desc: 'Pauta e ata',         pronto: false },
  { ic: 'i-doc',        nome: 'Documentos',    desc: 'Arquivos e mural',    pronto: false }
];

/* ---------- datas ----------
   A data vem do fuso da obra, não do fuso do aparelho: celular
   configurado errado não pode fazer o RDO cair no dia anterior. */
const FUSO = 'America/Sao_Paulo';
function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
function partesDeHoje() {
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, weekday: 'long', day: '2-digit', month: 'short'
  }).formatToParts(new Date());
  const p = (t) => (f.find(x => x.type === t) || {}).value || '';
  return {
    dia: p('day'),
    mes: p('month').replace('.', '').toUpperCase(),
    semana: p('weekday')
  };
}
function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

/* ---------- navegação entre telas ---------- */
function mostrar(qual) {
  $('carregando').hidden = qual !== 'carregando';
  $('tela-login').hidden = qual !== 'login';
  $('app').hidden        = qual !== 'app';
}

/* ---------- entrar ---------- */
$('form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const botao = $('btn-entrar');
  const erro  = $('erro-login');
  erro.hidden = true;
  botao.disabled = true;
  botao.textContent = 'Entrando…';

  const { error } = await db.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('senha').value
  });

  botao.disabled = false;
  botao.textContent = 'Entrar';

  if (error) {
    // Mensagem que diz o que fazer, não o código do erro.
    erro.textContent = /invalid login/i.test(error.message)
      ? 'E-mail ou senha não conferem. Verifique e tente de novo.'
      : 'Não consegui entrar: ' + error.message;
    erro.hidden = false;
    $('senha').value = '';
    $('senha').focus();
    return;
  }
  abrirApp();
});

$('btn-sair').addEventListener('click', async () => {
  await db.auth.signOut();
  mostrar('login');
  $('senha').value = '';
});

/* ---------- navegação dentro do app ---------- */
let _tela = 'painel';

function irPara(tela) {
  _tela = tela;
  $('tela-painel').hidden   = tela !== 'painel';
  $('tela-efetivo').hidden  = tela !== 'efetivo';
  $('tela-rdo').hidden      = tela !== 'rdo';
  $('tela-rdo-edit').hidden = tela !== 'rdo-edit';
  $('btn-voltar').hidden    = tela === 'painel';
  renderModulos(_status);
  window.scrollTo(0, 0);
  if (tela === 'efetivo') carregarEfetivo();
  if (tela === 'rdo')     carregarRDOs();
}

// De dentro do diário, voltar leva à lista de diários — não ao painel.
// Sair da obra inteira porque terminou um RDO seria perder o passo.
$('btn-voltar').addEventListener('click', async () => {
  if (_tela === 'rdo-edit') {
    _rdo = null;
    irPara('rdo');
    await carregarPainel();
    return;
  }
  irPara('painel');
});

/* ---------- abertura ---------- */
let _obras  = [];
let _obra   = null;
let _status = null;
let _funcoes = [];
let _perfilNome = null;

async function abrirApp() {
  mostrar('app');
  renderModulos(null);
  await carregarPerfil();
  await carregarObras();
}

async function carregarPerfil() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;

  const { data, error } = await db
    .from('perfis').select('nome, papel').eq('id', user.id).single();

  // Não invento nome. Se o perfil não veio, mostro o que existe.
  _perfilNome = (error || !data) ? null : (data.nome || null);
  $('estado-perfil').textContent = (error || !data)
    ? '· ' + user.email
    : '· ' + (data.nome || user.email) + ' · ' + (PAPEIS[data.papel] || data.papel);
}

async function carregarObras() {
  const { data, error } = await db
    .from('obras').select('id, codigo, nome, cidade, uf')
    .eq('ativa', true).order('codigo');

  if (error) {
    banco('erro', 'não consegui ler as obras');
    faixaAviso('Não consegui falar com o banco', 'Verifique a conexão e recarregue a página.', 'atrasado');
    return;
  }

  _obras = data || [];

  if (!_obras.length) {
    _obra = null;
    $('btn-obra').hidden = true;
    banco('ok', 'conectado · nenhuma obra');
    $('numeros').hidden = true;
    $('alertas-area').innerHTML = vazioHTML('Sem obra, não há prazo para acompanhar.');
    renderModulos(null);
    faixaAviso('Nenhuma obra cadastrada',
      'A obra é o chão de tudo: RDO, efetivo e nota fiscal pendem dela.',
      'pendente', [{ txt: 'Cadastrar obra', acao: abrirFolhaObra, tipo: 'btn-primario' }]);
    return;
  }

  // A obra escolhida fica guardada. Se a guardada sumiu do banco,
  // cai na primeira em vez de deixar a tela sem obra nenhuma.
  let id = ler('obra');
  if (!_obras.some(o => o.id === id)) id = _obras[0].id;
  guardar('obra', id);
  _obra = _obras.find(o => o.id === id);

  $('btn-obra').hidden = false;
  $('obra-cod').textContent  = _obra.codigo;
  $('obra-nome').textContent = _obra.nome;
  $('btn-obra').title = _obras.length > 1
    ? 'Trocar de obra' : 'Obra atual — cadastre outra para poder trocar';

  banco('ok', 'conectado · ' + plural(_obras.length, 'obra', 'obras'));
  $('numeros').hidden = false;
  await carregarPainel();
  if (_tela === 'efetivo') await carregarEfetivo();
}

/* ============================================================
   PAINEL
   Uma consulta traz a obra inteira (vw_status_obra); a segunda
   pergunta a única coisa que ela não responde: o RDO de HOJE já
   saiu? "Dias sem RDO" não serve — no primeiro dia da obra ele
   vem vazio, e vazio não é atraso.
   ============================================================ */
async function carregarPainel() {
  const [st, rdoHoje, alertas] = await Promise.all([
    db.from('vw_status_obra').select('*').eq('obra_id', _obra.id).maybeSingle(),
    db.from('rdos').select('id, numero').eq('obra_id', _obra.id).eq('data', hojeISO()).maybeSingle(),
    // vw_alertas.obra guarda o CÓDIGO da obra, não o nome. Filtrar pelo
    // nome devolve lista vazia sem erro nenhum — o pior tipo de defeito.
    db.from('vw_alertas').select('nome, funcao, tipo, vencimento, dias_restantes')
      .eq('obra', _obra.codigo).order('dias_restantes', { ascending: true }).limit(20)
  ]);

  const s = st.data || {};
  _status = s;
  renderFaixa(s, rdoHoje.data);
  renderNumeros(s);
  renderModulos(s);
  renderAlertas(alertas.error ? null : (alertas.data || []));
}

function renderFaixa(s, rdo) {
  const d = partesDeHoje();
  $('faixa-dia').firstChild.nodeValue = d.dia;
  $('faixa-mes').textContent = d.mes;
  $('faixa-semana').textContent = d.semana;

  const acao = [];
  let estado, titulo, linha;

  if (rdo) {
    estado = 'lancado';
    titulo = `RDO nº ${rdo.numero} lançado`;
    linha  = 'O diário de hoje já está no banco. Dá para complementar até o fim do turno.';
    acao.push({ txt: 'Abrir o RDO de hoje', tipo: 'btn-secundario',
                acao: () => { irPara('rdo'); abrirRDO(rdo.id); } });
  } else if (s.ultimo_rdo == null) {
    estado = 'pendente';
    titulo = 'Primeiro RDO da obra';
    linha  = `Nenhum diário lançado ainda em ${_obra.nome}.`;
    acao.push({ txt: 'Lançar o RDO de hoje', tipo: 'btn-primario', acao: lancarHoje });
  } else if ((s.dias_sem_rdo || 0) >= 2) {
    estado = 'atrasado';
    titulo = `${plural(s.dias_sem_rdo, 'dia', 'dias')} sem RDO`;
    linha  = `O último foi o de ${dataBR(s.ultimo_rdo)}. Diário em atraso trava a medição.`;
    acao.push({ txt: 'Lançar o RDO de hoje', tipo: 'btn-primario', acao: lancarHoje });
  } else {
    estado = 'pendente';
    titulo = 'RDO de hoje ainda não saiu';
    linha  = `O último foi o de ${dataBR(s.ultimo_rdo)}.`;
    acao.push({ txt: 'Lançar o RDO de hoje', tipo: 'btn-primario', acao: lancarHoje });
  }

  $('faixa').dataset.estado = estado;
  $('faixa-titulo').textContent = titulo;
  $('faixa-linha').textContent  = linha;
  pintarAcao(acao);
}

// Aviso na faixa quando não há obra ou o banco não respondeu.
function faixaAviso(titulo, linha, estado, acao) {
  const d = partesDeHoje();
  $('faixa-dia').firstChild.nodeValue = d.dia;
  $('faixa-mes').textContent = d.mes;
  $('faixa-semana').textContent = d.semana;
  $('faixa').dataset.estado = estado;
  $('faixa-titulo').textContent = titulo;
  $('faixa-linha').textContent  = linha;
  pintarAcao(acao || []);
}

function pintarAcao(lista) {
  const area = $('faixa-acao');
  area.innerHTML = '';
  area.hidden = !lista.length;
  lista.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.tipo || 'btn-secundario');
    b.textContent = a.txt;
    if (a.acao) b.addEventListener('click', a.acao);
    else b.disabled = true;
    area.appendChild(b);
  });
}

function renderNumeros(s) {
  const n = (v) => Number(v || 0);
  const atrasadas = n(s.tarefas_atrasadas);

  const tiles = [
    { rot: 'Efetivo ativo',   val: n(s.efetivo_ativo),
      sub: plural(n(s.contratos_ativos), 'contrato', 'contratos') },
    { rot: 'RDO · 30 dias',   val: n(s.rdos_30_dias),
      sub: s.ultimo_rdo ? 'último em ' + dataBR(s.ultimo_rdo) : 'nenhum lançado' },
    { rot: 'Tarefas abertas', val: n(s.tarefas_abertas),
      sub: atrasadas ? plural(atrasadas, 'atrasada', 'atrasadas') : 'nenhuma atrasada',
      urgente: atrasadas > 0 },
    { rot: 'Ocorrências', val: n(s.ocorrencias_30_dias),
      sub: 'nos últimos 30 dias' }
  ];

  const area = $('numeros');
  area.innerHTML = '';
  tiles.forEach(t => {
    const div = document.createElement('div');
    div.className = 'num';
    const rot = document.createElement('p'); rot.className = 'rotulo'; rot.textContent = t.rot;
    const val = document.createElement('b'); val.textContent = t.val;
    const sub = document.createElement('small');
    sub.textContent = t.sub;
    if (t.urgente) sub.className = 'alerta';
    div.append(rot, val, sub);
    area.appendChild(div);
  });
}

/* A vw_alertas só devolve o que vence em até 7 dias (e o que venceu há
   até 3). Faixa fora disso é cor que nunca acende — código se enganando.
   Até 3 dias é grave: experiência de CLT perdida por um dia vira
   contrato por prazo indeterminado. */
function nivel(dias) {
  if (dias == null) return 'calmo';
  if (dias <= 3) return 'grave';
  if (dias <= 7) return 'atencao';
  return 'calmo';
}
function prazoTexto(dias) {
  if (dias == null) return '—';
  if (dias < 0)  return plural(-dias, 'dia vencido', 'dias vencido');
  if (dias === 0) return 'hoje';
  return plural(dias, 'dia', 'dias');
}

const TIPO_ALERTA = {
  experiencia_45: 'Experiência 45 dias',
  experiencia_90: 'Experiência 90 dias',
  viagem:         'Viagem'
};

function renderAlertas(lista) {
  const area = $('alertas-area');

  if (lista === null) {
    area.innerHTML = vazioHTML('Não consegui ler os alertas desta obra.');
    return;
  }
  if (!lista.length) {
    area.innerHTML = vazioHTML(
      'Nenhum prazo vencendo nos próximos 7 dias.',
      'Experiência de 45 e 90 dias e viagem aparecem aqui quando chega a hora.');
    return;
  }

  {
    area.innerHTML = '<div class="lista"></div>';
    const cx = area.firstElementChild;
    lista.forEach(a => {
      const l = document.createElement('div');
      l.className = 'linha';
      l.dataset.nivel = nivel(a.dias_restantes);

      const tarja = document.createElement('span'); tarja.className = 'tarja';
      const miolo = document.createElement('span'); miolo.className = 'miolo';
      const quem  = document.createElement('span'); quem.className = 'quem';
      quem.textContent = a.nome;
      const oque  = document.createElement('span'); oque.className = 'oque';
      oque.textContent = [TIPO_ALERTA[a.tipo] || a.tipo, a.funcao,
                          a.vencimento ? dataBR(a.vencimento) : null]
        .filter(Boolean).join(' · ');
      miolo.append(quem, oque);
      const prazo = document.createElement('span'); prazo.className = 'prazo';
      prazo.textContent = prazoTexto(a.dias_restantes);

      l.append(tarja, miolo, prazo);
      cx.appendChild(l);
    });
  }
}

function vazioHTML(linha1, linha2) {
  return '<div class="vazio"><p><strong>' + linha1 + '</strong></p>' +
         (linha2 ? '<p>' + linha2 + '</p>' : '') + '</div>';
}

function renderModulos(s) {
  const grade = $('modulos');
  grade.innerHTML = '';
  MODULOS.forEach(m => {
    const b = document.createElement('button');
    b.className = 'modulo';
    b.type = 'button';
    if (!m.pronto) { b.disabled = true; b.title = m.nome + ' — tela em construção'; }
    else {
      if (_tela === m.tela || (_tela === 'rdo-edit' && m.tela === 'rdo'))
        b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => irPara(m.tela));
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ic'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + m.ic);
    svg.appendChild(use);

    const nome = document.createElement('b'); nome.textContent = m.nome;
    const desc = document.createElement('small');
    desc.textContent = m.pronto ? m.desc : 'em construção';

    b.append(svg, nome, desc);

    // Contador só quando há número de verdade. Zero não vira selo.
    const n = s && m.conta ? Number(s[m.conta] || 0) : 0;
    if (n > 0) {
      const c = document.createElement('span');
      c.className = 'conta'; c.textContent = n;
      b.appendChild(c);
    }
    grade.appendChild(b);
  });
}

function banco(estado, texto) {
  $('ponto-banco').dataset.estado = estado;
  $('estado-banco').textContent = 'Banco P3 · ' + texto;
}

/* ---------- escolher obra ---------- */
function abrirFolhaEscolha() {
  const lista = $('lista-obras');
  lista.innerHTML = '';
  _obras.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'obra-cartao' + (_obra && o.id === _obra.id ? ' atual' : '');

    const cod = document.createElement('span'); cod.className = 'cod'; cod.textContent = o.codigo;
    const nm  = document.createElement('span'); nm.className  = 'nm';  nm.textContent  = o.nome;
    const on  = document.createElement('span'); on.className  = 'onde';
    on.textContent = [o.cidade, o.uf].filter(Boolean).join(' · ');

    b.append(cod, nm, on);
    b.addEventListener('click', async () => {
      guardar('obra', o.id);
      $('folha-escolha').hidden = true;
      await carregarObras();
    });
    lista.appendChild(b);
  });
  $('folha-escolha').hidden = false;
}

$('btn-obra').addEventListener('click', abrirFolhaEscolha);
$('btn-fechar-escolha').addEventListener('click', () => { $('folha-escolha').hidden = true; });
$('folha-escolha').addEventListener('click', (ev) => {
  if (ev.target === $('folha-escolha')) $('folha-escolha').hidden = true;
});

/* ---------- nova obra ---------- */
function abrirFolhaObra() {
  $('folha-escolha').hidden = true;
  $('erro-obra').hidden = true;
  $('form-obra').reset();
  $('obra-empresa').value = 'Cesbe';
  $('folha-obra').hidden = false;
  $('obra-codigo').focus();
}
function fecharFolhaObra() { $('folha-obra').hidden = true; }

$('btn-nova-obra').addEventListener('click', abrirFolhaObra);
$('btn-fechar-obra').addEventListener('click', fecharFolhaObra);
$('folha-obra').addEventListener('click', (ev) => {
  if (ev.target === $('folha-obra')) fecharFolhaObra();
});

$('form-obra').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro  = $('erro-obra');
  const botao = $('btn-salvar-obra');
  erro.hidden = true;

  const codigo = $('obra-codigo').value.trim().toUpperCase();
  const nome   = $('obra-nome-in').value.trim();

  // Barra antes de mandar: erro que volta do banco chega em inglês.
  if (!codigo || !nome) {
    erro.textContent = 'Código e nome da obra são obrigatórios.';
    erro.hidden = false;
    return;
  }

  botao.disabled = true;
  botao.textContent = 'Salvando…';

  const { error } = await db.from('obras').insert({
    codigo,
    nome,
    cidade:            $('obra-cidade').value.trim(),
    uf:                $('obra-uf').value.trim().toUpperCase(),
    empresa_executora: $('obra-empresa').value.trim() || 'Cesbe',
    consorcio:         $('obra-consorcio').value.trim() || null,
    descricao_local:   $('obra-local').value.trim(),
    ativa: true
  });

  botao.disabled = false;
  botao.textContent = 'Salvar obra';

  if (error) {
    // O banco tem unicidade no CÓDIGO, não no nome. Traduzir importa:
    // a mensagem crua chega em inglês e falando de índice.
    erro.textContent = /duplicate|unique/i.test(error.message)
      ? `Já existe uma obra com o código ${codigo}. Escolha outro código, ou use a obra que já está cadastrada.`
      : 'Não consegui salvar: ' + error.message;
    erro.hidden = false;
    return;
  }

  fecharFolhaObra();
  await carregarObras();
});

/* ---------- teclado ---------- */
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  ['folha-obra','folha-escolha','folha-pessoa','folha-baixa']
    .forEach(id => { $(id).hidden = true; });
});

/* ---------- sinal ---------- */
function sinal() { $('sinal').hidden = navigator.onLine; }
window.addEventListener('online', sinal);
window.addEventListener('offline', sinal);

/* ---------- início ---------- */
(async function iniciar() {
  sinal();
  const { data: { session } } = await db.auth.getSession();
  if (session) { await abrirApp(); } else { mostrar('login'); }
})();

/* ============================================================
   EFETIVO — quem trabalha na obra
   A lista sai da vw_efetivo, que já resolve regime e próxima
   viagem. Para editar, aí sim vou nas tabelas: a view não
   devolve os id que o formulário precisa.
   ============================================================ */

let _efetivo   = [];
let _desligados = [];
let _editando  = null;   // { contrato_id, pessoa_id } quando é edição

const REGIME = {
  local:           'Local',
  viagem_familiar: 'Alojado',
  ajuda_moradia:   'Ajuda de custo'
};

async function carregarFuncoes() {
  if (_funcoes.length) return;
  const { data } = await db.from('funcoes')
    .select('id, nome, categoria, periodicidade_viagem_dias').order('nome');
  _funcoes = data || [];
}

async function carregarEfetivo() {
  $('efetivo-titulo').textContent = _obra ? _obra.nome : '—';
  const lista = $('efetivo-lista');

  if (!_obra) {
    lista.innerHTML = vazioHTML('Nenhuma obra escolhida.');
    return;
  }

  lista.innerHTML = vazioHTML('Carregando…');

  const [ativos, baixados] = await Promise.all([
    db.from('vw_efetivo')
      .select('contrato_id, nome, matricula, cracha, funcao, admissao, alojado, ' +
              'fim_experiencia_1, fim_experiencia_2, recebe_ajuda_custo, ' +
              'ajuda_custo_valor, proxima_viagem, regime')
      .eq('obra', _obra.codigo).order('nome'),
    db.from('contratos')
      .select('id, matricula, admissao, desligamento, motivo_desligamento, ' +
              'pessoa:pessoas(nome), funcao:funcoes(nome)')
      .eq('obra_id', _obra.id).not('desligamento', 'is', null)
      .order('desligamento', { ascending: false }).limit(50)
  ]);

  if (ativos.error) {
    lista.innerHTML = vazioHTML('Não consegui ler o efetivo desta obra.',
                                ativos.error.message);
    return;
  }

  _efetivo    = ativos.data || [];
  _desligados = baixados.error ? [] : (baixados.data || []);

  renderEfetivoNumeros();
  filtrarEfetivo();
  renderDesligados();
}

function renderEfetivoNumeros() {
  const alojados = _efetivo.filter(p => p.regime === 'viagem_familiar').length;
  const ajuda    = _efetivo.filter(p => p.regime === 'ajuda_moradia').length;
  const vencendo = _efetivo.filter(p => nivelPessoa(p).nivel !== 'calmo').length;

  const tiles = [
    { rot: 'Ativos',        val: _efetivo.length, sub: plural(_desligados.length, 'baixa', 'baixas') },
    { rot: 'No alojamento', val: alojados,        sub: 'entram no giro de viagem' },
    { rot: 'Ajuda de custo',val: ajuda,           sub: 'moradia paga' },
    { rot: 'Prazo em 7 dias', val: vencendo,      sub: vencendo ? 'exigem decisão' : 'nada vencendo',
      urgente: vencendo > 0 }
  ];

  const area = $('efetivo-numeros');
  area.innerHTML = '';
  tiles.forEach(t => {
    const div = document.createElement('div');
    div.className = 'num';
    const rot = document.createElement('p'); rot.className = 'rotulo'; rot.textContent = t.rot;
    const val = document.createElement('b'); val.textContent = t.val;
    const sub = document.createElement('small');
    sub.textContent = t.sub;
    if (t.urgente) sub.className = 'alerta';
    div.append(rot, val, sub);
    area.appendChild(div);
  });
}

/* Qual prazo desta pessoa aperta primeiro. Uso a mesma régua da
   vw_alertas para a tela não discordar do painel. */
function diasAte(iso) {
  if (!iso) return null;
  const hoje = new Date(hojeISO() + 'T00:00:00');
  const alvo = new Date(iso + 'T00:00:00');
  return Math.round((alvo - hoje) / 86400000);
}

function nivelPessoa(p) {
  const candidatos = [
    { rot: 'exp 45',  dias: diasAte(p.fim_experiencia_1) },
    { rot: 'exp 90',  dias: diasAte(p.fim_experiencia_2) },
    { rot: 'viagem',  dias: diasAte(p.proxima_viagem) }
  ].filter(c => c.dias !== null && c.dias <= 7 && c.dias >= -3);

  if (!candidatos.length) return { nivel: 'calmo' };
  candidatos.sort((a, b) => a.dias - b.dias);
  const c = candidatos[0];
  return { nivel: nivel(c.dias), rot: c.rot, dias: c.dias };
}

function filtrarEfetivo() {
  const termo = ($('busca-efetivo').value || '').trim().toLowerCase();
  const vistos = termo
    ? _efetivo.filter(p => [p.nome, p.matricula, p.cracha, p.funcao]
        .filter(Boolean).join(' ').toLowerCase().includes(termo))
    : _efetivo;

  const area = $('efetivo-lista');

  if (!_efetivo.length) {
    area.innerHTML = vazioHTML(
      'Ninguém no efetivo desta obra ainda.',
      'Toque em "+ Pessoa" para cadastrar o primeiro contrato.');
    return;
  }
  if (!vistos.length) {
    area.innerHTML = vazioHTML('Ninguém encontrado com "' + termo + '".');
    return;
  }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;

  vistos.forEach(p => {
    const n = nivelPessoa(p);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pessoa';
    b.dataset.nivel = n.nivel;

    const tarja = document.createElement('span'); tarja.className = 'tarja';

    const miolo = document.createElement('span'); miolo.className = 'miolo';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.nome;
    const sub = document.createElement('span'); sub.className = 'sub';
    sub.textContent = [p.funcao, p.matricula ? 'mat. ' + p.matricula : null,
                       'desde ' + dataBR(p.admissao)].filter(Boolean).join(' · ');
    miolo.append(nm, sub);

    const lado = document.createElement('span'); lado.className = 'lado';
    const reg = document.createElement('span');
    reg.className = 'chip'; reg.dataset.regime = p.regime;
    reg.textContent = REGIME[p.regime] || p.regime;
    lado.appendChild(reg);

    if (n.nivel !== 'calmo') {
      const pr = document.createElement('span');
      pr.className = 'chip prazo'; pr.dataset.nivel = n.nivel;
      pr.textContent = n.rot + ' ' + prazoTexto(n.dias);
      lado.appendChild(pr);
    }

    b.append(tarja, miolo, lado);
    b.addEventListener('click', () => abrirPessoa(p.contrato_id));
    cx.appendChild(b);
  });
}

$('busca-efetivo').addEventListener('input', filtrarEfetivo);

function renderDesligados() {
  const bloco = $('bloco-desligados');
  const botao = $('btn-desligados');
  const area  = $('desligados-lista');

  bloco.hidden = !_desligados.length;
  if (!_desligados.length) return;

  botao.textContent = 'Desligados (' + _desligados.length + ')';

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  _desligados.forEach(c => {
    const l = document.createElement('div');
    l.className = 'pessoa baixada';
    const tarja = document.createElement('span'); tarja.className = 'tarja';
    const miolo = document.createElement('span'); miolo.className = 'miolo';
    const nm = document.createElement('span'); nm.className = 'nm';
    nm.textContent = c.pessoa ? c.pessoa.nome : '—';
    const sub = document.createElement('span'); sub.className = 'sub';
    sub.textContent = [c.funcao ? c.funcao.nome : null,
                       'baixa em ' + dataBR(c.desligamento),
                       c.motivo_desligamento].filter(Boolean).join(' · ');
    miolo.append(nm, sub);
    l.append(tarja, miolo);
    cx.appendChild(l);
  });
}

$('btn-desligados').addEventListener('click', () => {
  const area = $('desligados-lista');
  area.hidden = !area.hidden;
  $('btn-desligados').setAttribute('aria-expanded', String(!area.hidden));
});

/* ============================================================
   PESSOA — cadastrar, editar, dar baixa
   ============================================================ */

function pintarFuncoes(escolhida) {
  const sel = $('p-funcao');
  sel.innerHTML = '<option value="">— escolha —</option>';
  const grupos = {};
  _funcoes.forEach(f => { (grupos[f.categoria] = grupos[f.categoria] || []).push(f); });
  const NOME_GRUPO = { lideranca: 'Liderança', operacional: 'Operacional', tecnica: 'Técnica' };
  Object.keys(grupos).sort().forEach(cat => {
    const g = document.createElement('optgroup');
    g.label = NOME_GRUPO[cat] || cat;
    grupos[cat].forEach(f => {
      const o = document.createElement('option');
      o.value = f.id;
      o.textContent = f.nome + ' · viagem a cada ' + f.periodicidade_viagem_dias + ' dias';
      if (f.id === escolhida) o.selected = true;
      g.appendChild(o);
    });
    sel.appendChild(g);
  });
}

// A dica do alojamento muda com a função: 30, 60 ou 90 dias não é
// detalhe — é o intervalo que vai gerar o alerta de viagem.
function atualizarDicaAlojado() {
  const f = _funcoes.find(x => x.id === $('p-funcao').value);
  $('dica-alojado').textContent = f
    ? `Marcando, entra no controle de viagem a cada ${f.periodicidade_viagem_dias} dias.`
    : 'Marcando, entra no controle de viagem conforme a função.';
}
$('p-funcao').addEventListener('change', () => { atualizarDicaAlojado(); avisarExperiencia(); });

// Mostra as duas datas de experiência antes de salvar, porque são
// calculadas pelo banco e o usuário não as digita em lugar nenhum.
function avisarExperiencia() {
  const d = $('p-admissao').value;
  const aviso = $('aviso-experiencia');
  if (!d) { aviso.hidden = true; return; }
  const base = new Date(d + 'T00:00:00');
  const mais = (n) => {
    const x = new Date(base); x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };
  aviso.textContent = `Experiência: 45 dias vence em ${dataBR(mais(45))}, ` +
                      `90 dias em ${dataBR(mais(90))}. O banco calcula sozinho.`;
  aviso.hidden = false;
}
$('p-admissao').addEventListener('change', avisarExperiencia);

function so_digitos(s) { return (s || '').replace(/\D/g, ''); }

function formataCPF(s) {
  const d = so_digitos(s).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2')
          .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}
$('p-cpf').addEventListener('input', (ev) => {
  ev.target.value = formataCPF(ev.target.value);
});

// Se o CPF já existe, a pessoa é reaproveitada em vez de duplicada.
// O banco tem CPF único: sem isto, o cadastro travaria com erro cru.
$('p-cpf').addEventListener('blur', async () => {
  const dica = $('dica-cpf');
  const cpf = so_digitos($('p-cpf').value);
  dica.hidden = true;
  if (cpf.length !== 11 || _editando) return;

  const { data } = await db.from('pessoas')
    .select('id, nome').eq('cpf', cpf).maybeSingle();
  if (!data) return;

  dica.textContent = `${data.nome} já está cadastrado com esse CPF. ` +
                     'Vou aproveitar o cadastro em vez de criar outro.';
  dica.hidden = false;
  if (!$('p-nome').value.trim()) $('p-nome').value = data.nome;
});

async function abrirFolhaPessoa() {
  await carregarFuncoes();
  _editando = null;
  $('form-pessoa').reset();
  $('titulo-pessoa').textContent = 'Nova pessoa';
  $('btn-desligar').hidden = true;
  $('erro-pessoa').hidden = true;
  $('dica-cpf').hidden = true;
  $('aviso-experiencia').hidden = true;
  $('p-admissao').value = hojeISO();
  pintarFuncoes(null);
  atualizarDicaAlojado();
  avisarExperiencia();
  $('folha-pessoa').hidden = false;
  $('p-nome').focus();
}

async function abrirPessoa(contratoId) {
  await carregarFuncoes();
  const { data, error } = await db.from('contratos')
    .select('id, matricula, cracha, admissao, alojado, data_ultima_viagem, funcao_id, ' +
            'pessoa:pessoas(id, nome, cpf, telefone, cidade_origem, uf_origem)')
    .eq('id', contratoId).single();

  if (error || !data) {
    toastErro('Não consegui abrir esse contrato: ' + (error ? error.message : 'não encontrado'));
    return;
  }

  _editando = { contrato_id: data.id, pessoa_id: data.pessoa.id };
  $('titulo-pessoa').textContent = data.pessoa.nome;
  $('p-nome').value      = data.pessoa.nome || '';
  $('p-cpf').value       = data.pessoa.cpf ? formataCPF(data.pessoa.cpf) : '';
  $('p-telefone').value  = data.pessoa.telefone || '';
  $('p-cidade').value    = data.pessoa.cidade_origem || '';
  $('p-uf').value        = data.pessoa.uf_origem || '';
  $('p-admissao').value  = data.admissao || '';
  $('p-matricula').value = data.matricula || '';
  $('p-cracha').value    = data.cracha || '';
  $('p-viagem').value    = data.data_ultima_viagem || '';
  $('p-alojado').checked = !!data.alojado;
  pintarFuncoes(data.funcao_id);
  atualizarDicaAlojado();
  avisarExperiencia();
  $('btn-desligar').hidden = false;
  $('erro-pessoa').hidden = true;
  $('dica-cpf').hidden = true;
  $('folha-pessoa').hidden = false;
}

function fecharFolhaPessoa() { $('folha-pessoa').hidden = true; }

$('btn-nova-pessoa').addEventListener('click', abrirFolhaPessoa);
$('btn-fechar-pessoa').addEventListener('click', fecharFolhaPessoa);
$('folha-pessoa').addEventListener('click', (ev) => {
  if (ev.target === $('folha-pessoa')) fecharFolhaPessoa();
});

$('form-pessoa').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro  = $('erro-pessoa');
  const botao = $('btn-salvar-pessoa');
  erro.hidden = true;

  const nome     = $('p-nome').value.trim();
  const funcaoId = $('p-funcao').value;
  const admissao = $('p-admissao').value;
  const cpf      = so_digitos($('p-cpf').value);

  if (!nome)              return falhar(erro, 'O nome completo é obrigatório.');
  if (!funcaoId)          return falhar(erro, 'Escolha a função.');
  if (!admissao)          return falhar(erro, 'A data de admissão é obrigatória.');
  if (cpf && cpf.length !== 11)
    return falhar(erro, 'O CPF tem que ter 11 dígitos, ou ficar em branco.');

  botao.disabled = true;
  botao.textContent = 'Salvando…';

  const dadosPessoa = {
    nome,
    cpf:           cpf || null,
    telefone:      $('p-telefone').value.trim() || null,
    cidade_origem: $('p-cidade').value.trim() || null,
    uf_origem:     $('p-uf').value.trim().toUpperCase() || null
  };
  // Nunca mando ativo nem fim_experiencia: são colunas calculadas
  // pelo banco, e escrever nelas é erro na hora.
  const dadosContrato = {
    funcao_id:          funcaoId,
    admissao,
    matricula:          $('p-matricula').value.trim() || null,
    cracha:             $('p-cracha').value.trim() || null,
    alojado:            $('p-alojado').checked,
    data_ultima_viagem: $('p-viagem').value || null
  };

  const r = _editando
    ? await salvarEdicao(dadosPessoa, dadosContrato)
    : await salvarNovo(dadosPessoa, dadosContrato, cpf);

  botao.disabled = false;
  botao.textContent = 'Salvar';

  if (r.erro) { erro.textContent = r.erro; erro.hidden = false; return; }

  fecharFolhaPessoa();
  await carregarEfetivo();
  await carregarPainel();
});

function falhar(el, msg) { el.textContent = msg; el.hidden = false; }

async function salvarEdicao(dadosPessoa, dadosContrato) {
  const p = await db.from('pessoas').update(dadosPessoa).eq('id', _editando.pessoa_id);
  if (p.error) return { erro: traduzir(p.error, dadosPessoa) };
  const c = await db.from('contratos').update(dadosContrato).eq('id', _editando.contrato_id);
  if (c.error) return { erro: traduzir(c.error, dadosPessoa) };
  return {};
}

async function salvarNovo(dadosPessoa, dadosContrato, cpf) {
  let pessoaId = null;

  // Pessoa que já existe é reaproveitada — o CPF é único no banco,
  // e a mesma pessoa pode passar por várias obras ao longo do tempo.
  if (cpf) {
    const { data } = await db.from('pessoas').select('id').eq('cpf', cpf).maybeSingle();
    if (data) {
      pessoaId = data.id;
      await db.from('pessoas').update(dadosPessoa).eq('id', pessoaId);
    }
  }

  if (!pessoaId) {
    const { data, error } = await db.from('pessoas').insert(dadosPessoa).select('id').single();
    if (error) return { erro: traduzir(error, dadosPessoa) };
    pessoaId = data.id;
  }

  const { error } = await db.from('contratos').insert({
    ...dadosContrato, pessoa_id: pessoaId, obra_id: _obra.id
  });
  if (error) return { erro: traduzir(error, dadosPessoa) };
  return {};
}

// O banco fala inglês e em nome de índice. Aqui vira português com
// o que fazer a seguir.
function traduzir(error, dados) {
  const m = error.message || '';
  if (/uq_contrato_ativo/.test(m)) {
    return `${dados.nome} já tem um contrato ativo — nesta obra ou em outra. ` +
           'Dê baixa no contrato anterior antes de admitir de novo.';
  }
  if (/pessoas_cpf_key/.test(m)) {
    return 'Esse CPF já está cadastrado para outra pessoa. Confira o número.';
  }
  if (/chk_desligamento/.test(m)) {
    return 'A data de desligamento não pode ser anterior à admissão.';
  }
  if (/can only be updated to DEFAULT|generated/i.test(m)) {
    return 'Tentei escrever numa coluna que o banco calcula sozinho. Isso é defeito meu, me avise.';
  }
  return 'Não consegui salvar: ' + m;
}

/* ---------- dar baixa ---------- */
$('btn-desligar').addEventListener('click', () => {
  if (!_editando) return;
  const p = _efetivo.find(x => x.contrato_id === _editando.contrato_id);
  $('explica-baixa').textContent = p
    ? `${p.nome} sai do efetivo a partir da data abaixo. O contrato não é apagado: ` +
      'fica no histórico, e os RDO já lançados continuam mostrando a presença dele.'
    : 'O contrato não é apagado: fica no histórico.';
  $('b-data').value = hojeISO();
  $('b-data').min = p ? p.admissao : '';
  $('b-motivo').value = '';
  $('erro-baixa').hidden = true;
  $('folha-baixa').hidden = false;
});

function fecharFolhaBaixa() { $('folha-baixa').hidden = true; }
$('btn-fechar-baixa').addEventListener('click', fecharFolhaBaixa);
$('folha-baixa').addEventListener('click', (ev) => {
  if (ev.target === $('folha-baixa')) fecharFolhaBaixa();
});

$('form-baixa').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro  = $('erro-baixa');
  const botao = $('btn-confirma-baixa');
  erro.hidden = true;

  const data = $('b-data').value;
  if (!data) return falhar(erro, 'Informe a data do desligamento.');

  const p = _efetivo.find(x => x.contrato_id === _editando.contrato_id);
  if (p && data < p.admissao) {
    return falhar(erro, `A baixa não pode ser antes da admissão (${dataBR(p.admissao)}).`);
  }

  botao.disabled = true;
  botao.textContent = 'Dando baixa…';

  const { error } = await db.from('contratos').update({
    desligamento: data,
    motivo_desligamento: $('b-motivo').value || null
  }).eq('id', _editando.contrato_id);

  botao.disabled = false;
  botao.textContent = 'Confirmar baixa';

  if (error) return falhar(erro, traduzir(error, p || {}));

  fecharFolhaBaixa();
  fecharFolhaPessoa();
  await carregarEfetivo();
  await carregarPainel();
});

function toastErro(msg) {
  const erro = $('erro-pessoa');
  erro.textContent = msg;
  erro.hidden = false;
  $('folha-pessoa').hidden = false;
}

/* ============================================================
   RDO — o diário de obra
   Cada parte grava sozinha. Um botão "salvar" no fim de uma tela
   deste tamanho é convite a perder o dia inteiro de apontamento
   quando o sinal cai no canteiro.
   ============================================================ */

const CLIMAS = ['Bom', 'Nublado', 'Garoa', 'Chuva fraca', 'Chuva forte', 'Vento forte'];

const SITUACOES = [
  ['presente',          'Presente'],
  ['falta',             'Falta'],
  ['falta_justificada', 'Falta justificada'],
  ['atestado',          'Atestado'],
  ['ferias',            'Férias'],
  ['folga',             'Folga']
];

const CONDICAO = {
  praticavel: 'Praticável',
  parcialmente_impraticavel: 'Parcialmente impraticável',
  impraticavel: 'Impraticável'
};

let _rdos      = [];
let _rdo       = null;   // o diário aberto
let _presencas = [];
let _equipObra = [];

/* ---------- lista ---------- */
async function carregarRDOs() {
  $('rdo-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('rdo-lista');

  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');
  const { data, error } = await db.from('vw_rdo_resumo')
    .select('rdo_id, numero, data, efetivo, homem_hora, total_horas_extras')
    .eq('obra', _obra.codigo).order('data', { ascending: false }).limit(60);

  if (error) { area.innerHTML = vazioHTML('Não consegui ler os diários.', error.message); return; }

  _rdos = data || [];

  if (!_rdos.length) {
    area.innerHTML = vazioHTML('Nenhum diário lançado nesta obra.',
      'O RDO é o documento do dia: quem trabalhou, quantas horas e o que foi feito.');
    return;
  }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  _rdos.forEach(r => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rdo-item';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = 'nº ' + r.numero;
    const miolo = document.createElement('span'); miolo.className = 'miolo';
    const dt = document.createElement('span'); dt.className = 'dt'; dt.textContent = dataBR(r.data);
    const sub = document.createElement('span'); sub.className = 'sub';
    sub.textContent = plural(Number(r.efetivo || 0), 'pessoa', 'pessoas') +
      ' · ' + Number(r.homem_hora || 0).toLocaleString('pt-BR') + ' h' +
      (Number(r.total_horas_extras) ? ' · ' + Number(r.total_horas_extras).toLocaleString('pt-BR') + ' h extra' : '');
    miolo.append(dt, sub);
    b.append(n, miolo);
    b.addEventListener('click', () => abrirRDO(r.rdo_id));
    cx.appendChild(b);
  });
}

/* ---------- criar ---------- */
function abrirFolhaNovoRDO() {
  $('n-data').value = hojeISO();
  $('n-data').max = hojeISO();
  $('erro-novo-rdo').hidden = true;
  explicarNovoRDO();
  $('folha-novo-rdo').hidden = false;
}

function explicarNovoRDO() {
  const d = $('n-data').value;
  const jaTem = _rdos.find(r => r.data === d);
  $('explica-novo-rdo').textContent = jaTem
    ? `Já existe o RDO nº ${jaTem.numero} nesse dia. Abra ele em vez de criar outro.`
    : 'Ao abrir, todo mundo com contrato ativo nesse dia entra como presente com 8 horas. ' +
      'Você marca só as exceções.';
}
$('n-data').addEventListener('change', explicarNovoRDO);

$('btn-novo-rdo').addEventListener('click', abrirFolhaNovoRDO);
$('btn-fechar-novo-rdo').addEventListener('click', () => { $('folha-novo-rdo').hidden = true; });
$('folha-novo-rdo').addEventListener('click', (ev) => {
  if (ev.target === $('folha-novo-rdo')) $('folha-novo-rdo').hidden = true;
});

$('form-novo-rdo').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-novo-rdo');
  const botao = $('btn-criar-rdo');
  erro.hidden = true;

  const data = $('n-data').value;
  if (!data) return falhar(erro, 'Escolha o dia do diário.');
  if (data > hojeISO()) return falhar(erro, 'Não dá para lançar diário de um dia que ainda não chegou.');

  const jaTem = _rdos.find(r => r.data === data);
  if (jaTem) {
    $('folha-novo-rdo').hidden = true;
    return abrirRDO(jaTem.rdo_id);
  }

  botao.disabled = true; botao.textContent = 'Abrindo…';
  const r = await criarRDO(data);
  botao.disabled = false; botao.textContent = 'Abrir o diário';

  if (r.erro) return falhar(erro, r.erro);
  $('folha-novo-rdo').hidden = true;
  await carregarRDOs();
  await abrirRDO(r.id);
  await carregarPainel();
});

async function criarRDO(data) {
  // O número não tem valor automático no banco: é sequencial por obra
  // e o app calcula. Se dois aparelhos criarem ao mesmo tempo, o índice
  // único recusa o segundo — por isso a segunda tentativa recalcula.
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { data: ultimo } = await db.from('rdos')
      .select('numero').eq('obra_id', _obra.id)
      .order('numero', { ascending: false }).limit(1).maybeSingle();

    const numero = (ultimo ? ultimo.numero : 0) + 1;

    const { data: novo, error } = await db.from('rdos').insert({
      obra_id: _obra.id, numero, data,
      apontador: _perfilNome || null
    }).select('id').single();

    if (!error) {
      await semearPresencas(novo.id, data);
      return { id: novo.id };
    }
    if (/uq_rdo_obra_data/.test(error.message)) {
      return { erro: `Já existe um diário do dia ${dataBR(data)} nesta obra.` };
    }
    if (/uq_rdo_obra_numero/.test(error.message)) continue;   // outro aparelho pegou o número
    return { erro: 'Não consegui abrir o diário: ' + error.message };
  }
  return { erro: 'Dois diários foram criados ao mesmo tempo. Tente de novo.' };
}

// Quem tinha contrato ativo NAQUELE dia — não hoje. Diário de ontem
// não pode listar quem foi admitido hoje.
async function semearPresencas(rdoId, data) {
  const { data: ativos } = await db.from('contratos')
    .select('id').eq('obra_id', _obra.id)
    .lte('admissao', data)
    .or(`desligamento.is.null,desligamento.gte.${data}`);

  if (!ativos || !ativos.length) return;
  await db.from('rdo_presencas').insert(
    ativos.map(c => ({ rdo_id: rdoId, contrato_id: c.id, situacao: 'presente',
                       horas_normais: 8, horas_extras: 0 }))
  );
}

/* ---------- abrir ---------- */
async function abrirRDO(id) {
  irPara('rdo-edit');

  const { data, error } = await db.from('rdos').select('*').eq('id', id).single();
  if (error || !data) { falhar($('erro-rdo'), 'Não consegui abrir esse diário.'); return; }

  _rdo = data;
  $('rdo-e-obra').textContent   = _obra.codigo + ' · ' + _obra.nome;
  $('rdo-e-numero').textContent = 'nº ' + data.numero;
  $('rdo-e-data').textContent   = dataBR(data.data);
  $('rdo-e-semana').textContent = new Intl.DateTimeFormat('pt-BR',
    { timeZone: FUSO, weekday: 'long' }).format(new Date(data.data + 'T12:00:00'));

  pintarClimas();
  ['clima_manha','clima_tarde','condicao_trabalho','jornada','apontador',
   'dss_horario','dss_tema','dss_ministrado_por','observacoes','eventos_meio_ambiente']
    .forEach(c => {
      const el = document.querySelector(`#tela-rdo-edit [data-campo="${c}"]`);
      if (el) el.value = data[c] == null ? '' : data[c];
    });

  await Promise.all([carregarPresencas(), carregarAtividades(), carregarFotos(), carregarEquipRDO()]);
}

function pintarClimas() {
  ['r-clima-manha','r-clima-tarde'].forEach(id => {
    const sel = $(id);
    sel.innerHTML = '<option value="">— não informado —</option>';
    CLIMAS.forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  });
}

/* Grava o campo assim que ele muda. Sem botão de salvar: no canteiro,
   uma tela deste tamanho que perde tudo ao cair o sinal é inaceitável. */
function ligarCamposDoRDO() {
  document.querySelectorAll('#tela-rdo-edit [data-campo]').forEach(el => {
    const evento = el.tagName === 'SELECT' ? 'change' : 'blur';
    el.addEventListener(evento, async () => {
      if (!_rdo) return;
      const campo = el.dataset.campo;
      const valor = el.value === '' ? null : el.value;
      if ((_rdo[campo] == null ? '' : String(_rdo[campo])) === (valor == null ? '' : valor)) return;
      const { error } = await db.from('rdos').update({ [campo]: valor }).eq('id', _rdo.id);
      if (error) { falhar($('erro-rdo'), 'Não consegui gravar: ' + error.message); return; }
      _rdo[campo] = valor;
      $('erro-rdo').hidden = true;
      avisarGravado();
    });
  });
}

let _relogioGravou = null;
function avisarGravado() {
  const s = $('gravou');
  s.hidden = false;
  clearTimeout(_relogioGravou);
  _relogioGravou = setTimeout(() => { s.hidden = true; }, 1800);
}

/* ---------- presença ---------- */
async function carregarPresencas() {
  const area = $('presenca-lista');
  const { data, error } = await db.from('rdo_presencas')
    .select('id, contrato_id, horas_normais, horas_extras, situacao, observacao, ' +
            'contrato:contratos(id, matricula, pessoa:pessoas(nome), funcao:funcoes(nome))')
    .eq('rdo_id', _rdo.id);

  if (error) { area.innerHTML = vazioHTML('Não consegui ler a chamada.', error.message); return; }

  _presencas = (data || []).sort((a, b) =>
    (a.contrato?.pessoa?.nome || '').localeCompare(b.contrato?.pessoa?.nome || '', 'pt-BR'));

  $('acoes-presenca').hidden = !_presencas.length;

  if (!_presencas.length) {
    area.innerHTML = vazioHTML('Ninguém tinha contrato ativo neste dia.',
      'Cadastre o efetivo primeiro — a chamada sai de lá.');
    resumoPresenca();
    return;
  }

  area.innerHTML = '<div class="chamada"></div>';
  const cx = area.firstElementChild;
  _presencas.forEach(p => cx.appendChild(linhaPresenca(p)));
  resumoPresenca();
}

function linhaPresenca(p) {
  const l = document.createElement('div');
  l.className = 'presente-linha';
  l.dataset.situacao = p.situacao;

  const quem = document.createElement('div'); quem.className = 'quem';
  const nm = document.createElement('span'); nm.className = 'nm';
  nm.textContent = p.contrato?.pessoa?.nome || '—';
  const fn = document.createElement('span'); fn.className = 'fn';
  fn.textContent = [p.contrato?.funcao?.nome,
                    p.contrato?.matricula ? 'mat. ' + p.contrato.matricula : null]
                   .filter(Boolean).join(' · ');
  quem.append(nm, fn);

  const sel = document.createElement('select');
  sel.setAttribute('aria-label', 'Situação de ' + (p.contrato?.pessoa?.nome || ''));
  SITUACOES.forEach(([v, rot]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = rot;
    if (v === p.situacao) o.selected = true;
    sel.appendChild(o);
  });

  const horas = document.createElement('div'); horas.className = 'horas';
  const mkHoras = (rotulo, valor, campo) => {
    const lab = document.createElement('label');
    lab.append(document.createTextNode(rotulo));
    const inp = document.createElement('input');
    inp.type = 'number'; inp.inputMode = 'decimal'; inp.min = '0'; inp.step = '0.5';
    inp.value = Number(valor);
    inp.dataset.campo = campo;
    lab.appendChild(inp);
    return { lab, inp };
  };
  const hn = mkHoras('Normais', p.horas_normais, 'horas_normais');
  const he = mkHoras('Extras',  p.horas_extras,  'horas_extras');
  horas.append(hn.lab, he.lab);

  // Quem não veio não tem hora normal. Zerar sozinho evita o erro mais
  // comum do apontamento: marcar falta e deixar as 8 horas lá.
  sel.addEventListener('change', async () => {
    const nova = sel.value;
    const zera = nova !== 'presente';
    if (zera) { hn.inp.value = 0; he.inp.value = 0; }
    else if (Number(hn.inp.value) === 0) { hn.inp.value = 8; }
    l.dataset.situacao = nova;
    await gravarPresenca(p, {
      situacao: nova,
      horas_normais: Number(hn.inp.value),
      horas_extras:  Number(he.inp.value)
    });
  });

  [hn.inp, he.inp].forEach(inp => {
    inp.addEventListener('change', async () => {
      const v = Number(inp.value);
      if (!(v >= 0)) { inp.value = 0; }
      await gravarPresenca(p, { [inp.dataset.campo]: Number(inp.value) });
    });
  });

  const marcacao = document.createElement('div');
  marcacao.className = 'marcacao';
  marcacao.append(sel, horas);

  l.append(quem, marcacao);
  return l;
}

async function gravarPresenca(p, mudanca) {
  const { error } = await db.from('rdo_presencas').update(mudanca).eq('id', p.id);
  if (error) { falhar($('erro-rdo'), 'Não consegui gravar a chamada: ' + error.message); return; }
  Object.assign(p, mudanca);
  $('erro-rdo').hidden = true;
  resumoPresenca();
  avisarGravado();
}

function resumoPresenca() {
  const presentes = _presencas.filter(p => p.situacao === 'presente');
  const hh = presentes.reduce((s, p) =>
    s + Number(p.horas_normais || 0) + Number(p.horas_extras || 0), 0);
  const faltas = _presencas.filter(p => p.situacao === 'falta').length;
  $('resumo-presenca').textContent =
    `${presentes.length} de ${_presencas.length} · ${hh.toLocaleString('pt-BR')} h` +
    (faltas ? ` · ${plural(faltas, 'falta', 'faltas')}` : '');
}

$('btn-todos-presentes').addEventListener('click', async () => {
  const alvos = _presencas.filter(p => p.situacao !== 'presente' || Number(p.horas_normais) !== 8);
  if (!alvos.length) return;
  for (const p of alvos) {
    await db.from('rdo_presencas')
      .update({ situacao: 'presente', horas_normais: 8 }).eq('id', p.id);
  }
  await carregarPresencas();
  avisarGravado();
});

/* ---------- atividades ---------- */
let _atividades = [];
let _atvEditando = null;

async function carregarAtividades() {
  const { data } = await db.from('rdo_atividades')
    .select('id, descricao, local, percentual_executado').eq('rdo_id', _rdo.id);
  _atividades = data || [];
  const area = $('atividade-lista');

  if (!_atividades.length) {
    area.innerHTML = vazioHTML('Nada lançado ainda.',
      'É esta parte que vira a memória do que a obra fez no dia.');
    return;
  }

  area.innerHTML = '<div class="pilha"></div>';
  const cx = area.firstElementChild;
  _atividades.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'item';
    const corpo = document.createElement('span'); corpo.className = 'corpo';
    const d = document.createElement('b'); d.textContent = a.descricao;
    corpo.appendChild(d);
    if (a.local) {
      const s = document.createElement('small'); s.textContent = a.local;
      corpo.appendChild(s);
    }
    b.appendChild(corpo);
    if (a.percentual_executado != null) {
      const m = document.createElement('span'); m.className = 'medida';
      m.textContent = Number(a.percentual_executado).toLocaleString('pt-BR') + '%';
      b.appendChild(m);
    }
    b.addEventListener('click', () => abrirAtividade(a));
    cx.appendChild(b);
  });
}

function abrirAtividade(a) {
  _atvEditando = a || null;
  $('titulo-atividade').textContent = a ? 'Atividade' : 'Nova atividade';
  $('a-descricao').value  = a ? a.descricao : '';
  $('a-local').value      = a && a.local ? a.local : '';
  $('a-percentual').value = a && a.percentual_executado != null ? a.percentual_executado : '';
  $('btn-apagar-atividade').hidden = !a;
  $('erro-atividade').hidden = true;
  $('folha-atividade').hidden = false;
}

$('btn-add-atividade').addEventListener('click', () => abrirAtividade(null));
$('btn-fechar-atividade').addEventListener('click', () => { $('folha-atividade').hidden = true; });
$('folha-atividade').addEventListener('click', (ev) => {
  if (ev.target === $('folha-atividade')) $('folha-atividade').hidden = true;
});

$('form-atividade').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-atividade');
  erro.hidden = true;

  const descricao = $('a-descricao').value.trim();
  if (!descricao) return falhar(erro, 'Escreva o que foi executado.');

  const pct = $('a-percentual').value === '' ? null : Number($('a-percentual').value);
  if (pct != null && (pct < 0 || pct > 100))
    return falhar(erro, 'O percentual vai de 0 a 100.');

  const linha = { descricao, local: $('a-local').value.trim() || null, percentual_executado: pct };
  const { error } = _atvEditando
    ? await db.from('rdo_atividades').update(linha).eq('id', _atvEditando.id)
    : await db.from('rdo_atividades').insert({ ...linha, rdo_id: _rdo.id });

  if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  $('folha-atividade').hidden = true;
  await carregarAtividades();
  avisarGravado();
});

$('btn-apagar-atividade').addEventListener('click', async () => {
  if (!_atvEditando) return;
  await db.from('rdo_atividades').delete().eq('id', _atvEditando.id);
  $('folha-atividade').hidden = true;
  await carregarAtividades();
});

/* ---------- fotos ---------- */
let _fotos = [];
let _fotoEditando = null;

async function carregarFotos() {
  const { data } = await db.from('rdo_fotos')
    .select('id, url_drive, legenda, ordem').eq('rdo_id', _rdo.id).order('ordem');
  _fotos = data || [];
  const area = $('foto-lista');

  if (!_fotos.length) { area.innerHTML = vazioHTML('Nenhuma foto ligada a este dia.'); return; }

  area.innerHTML = '<div class="pilha"></div>';
  const cx = area.firstElementChild;
  _fotos.forEach(f => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'item';
    const corpo = document.createElement('span'); corpo.className = 'corpo';
    const t = document.createElement('b');
    t.textContent = f.legenda || 'Sem legenda';
    const u = document.createElement('small');
    u.textContent = f.url_drive;
    corpo.append(t, u);
    b.appendChild(corpo);
    b.addEventListener('click', () => abrirFoto(f));
    cx.appendChild(b);
  });
}

function abrirFoto(f) {
  _fotoEditando = f || null;
  $('f-url').value     = f ? f.url_drive : '';
  $('f-legenda').value = f && f.legenda ? f.legenda : '';
  $('btn-apagar-foto').hidden = !f;
  $('erro-foto').hidden = true;
  $('folha-foto').hidden = false;
}

$('btn-add-foto').addEventListener('click', () => abrirFoto(null));
$('btn-fechar-foto').addEventListener('click', () => { $('folha-foto').hidden = true; });
$('folha-foto').addEventListener('click', (ev) => {
  if (ev.target === $('folha-foto')) $('folha-foto').hidden = true;
});

$('form-foto').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-foto');
  erro.hidden = true;

  const url = $('f-url').value.trim();
  if (!url) return falhar(erro, 'Cole o link da foto no Drive.');
  if (!/^https?:\/\//i.test(url))
    return falhar(erro, 'O link precisa começar com https://. Use "Compartilhar > Copiar link" no Drive.');

  const linha = { url_drive: url, legenda: $('f-legenda').value.trim() || null };
  const { error } = _fotoEditando
    ? await db.from('rdo_fotos').update(linha).eq('id', _fotoEditando.id)
    : await db.from('rdo_fotos').insert({ ...linha, rdo_id: _rdo.id, ordem: _fotos.length + 1 });

  if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  $('folha-foto').hidden = true;
  await carregarFotos();
  avisarGravado();
});

$('btn-apagar-foto').addEventListener('click', async () => {
  if (!_fotoEditando) return;
  await db.from('rdo_fotos').delete().eq('id', _fotoEditando.id);
  $('folha-foto').hidden = true;
  await carregarFotos();
});

/* ---------- equipamentos ---------- */
let _equipRDO = [];
let _equipEditando = null;

async function carregarEquipRDO() {
  const [noRdo, daObra] = await Promise.all([
    db.from('rdo_equipamentos')
      .select('id, equipamento_id, horas_operando, horas_paradas, motivo_parada, ' +
              'equipamento:equipamentos(prefixo, tipo, modelo)')
      .eq('rdo_id', _rdo.id),
    db.from('equipamentos').select('id, prefixo, tipo, modelo')
      .eq('obra_id', _obra.id).eq('ativo', true).order('prefixo')
  ]);

  _equipRDO  = noRdo.data || [];
  _equipObra = daObra.data || [];

  const area = $('equip-lista');
  $('btn-add-equip').hidden = !_equipObra.length;

  if (!_equipObra.length) {
    area.innerHTML = vazioHTML('Nenhum equipamento cadastrado nesta obra.',
      'A tela de Equipamentos ainda está em construção — quando existir, a frota aparece aqui.');
    return;
  }
  if (!_equipRDO.length) {
    area.innerHTML = vazioHTML('Nenhum equipamento lançado neste dia.');
    return;
  }

  area.innerHTML = '<div class="pilha"></div>';
  const cx = area.firstElementChild;
  _equipRDO.forEach(e => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'item';
    const corpo = document.createElement('span'); corpo.className = 'corpo';
    const t = document.createElement('b');
    t.textContent = [e.equipamento?.prefixo, e.equipamento?.tipo].filter(Boolean).join(' · ');
    const s = document.createElement('small');
    s.textContent = e.motivo_parada || (e.equipamento?.modelo || '');
    corpo.append(t, s);
    const m = document.createElement('span'); m.className = 'medida';
    m.textContent = Number(e.horas_operando).toLocaleString('pt-BR') + ' h op' +
      (Number(e.horas_paradas) ? ' · ' + Number(e.horas_paradas).toLocaleString('pt-BR') + ' h par' : '');
    b.append(corpo, m);
    b.addEventListener('click', () => abrirEquip(e));
    cx.appendChild(b);
  });
}

function abrirEquip(e) {
  _equipEditando = e || null;
  const sel = $('e-equip');
  sel.innerHTML = '<option value="">— escolha —</option>';
  // Equipamento que já está no dia não reaparece na lista: o banco tem
  // índice único por (rdo, equipamento) e recusaria o segundo lançamento.
  _equipObra
    .filter(q => !_equipRDO.some(x => x.equipamento_id === q.id) || (e && e.equipamento_id === q.id))
    .forEach(q => {
      const o = document.createElement('option');
      o.value = q.id;
      o.textContent = [q.prefixo, q.tipo, q.modelo].filter(Boolean).join(' · ');
      if (e && e.equipamento_id === q.id) o.selected = true;
      sel.appendChild(o);
    });

  $('e-operando').value = e ? Number(e.horas_operando) : 0;
  $('e-paradas').value  = e ? Number(e.horas_paradas)  : 0;
  $('e-motivo').value   = e && e.motivo_parada ? e.motivo_parada : '';
  $('btn-apagar-equip').hidden = !e;
  $('erro-equip').hidden = true;
  $('folha-equip').hidden = false;
}

$('btn-add-equip').addEventListener('click', () => abrirEquip(null));
$('btn-fechar-equip').addEventListener('click', () => { $('folha-equip').hidden = true; });
$('folha-equip').addEventListener('click', (ev) => {
  if (ev.target === $('folha-equip')) $('folha-equip').hidden = true;
});

$('form-equip').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-equip');
  erro.hidden = true;

  const eq = $('e-equip').value;
  if (!eq) return falhar(erro, 'Escolha o equipamento.');

  const op  = Number($('e-operando').value || 0);
  const par = Number($('e-paradas').value  || 0);
  if (op < 0 || par < 0) return falhar(erro, 'Horas não podem ser negativas.');
  if (op + par > 24) return falhar(erro, 'Operando mais paradas passa de 24 horas no mesmo dia.');

  const linha = { equipamento_id: eq, horas_operando: op, horas_paradas: par,
                  motivo_parada: $('e-motivo').value.trim() || null };
  const { error } = _equipEditando
    ? await db.from('rdo_equipamentos').update(linha).eq('id', _equipEditando.id)
    : await db.from('rdo_equipamentos').insert({ ...linha, rdo_id: _rdo.id });

  if (error) {
    return falhar(erro, /uq_rdo_equip/.test(error.message)
      ? 'Esse equipamento já foi lançado neste dia. Edite o lançamento que existe.'
      : 'Não consegui salvar: ' + error.message);
  }
  $('folha-equip').hidden = true;
  await carregarEquipRDO();
  avisarGravado();
});

$('btn-apagar-equip').addEventListener('click', async () => {
  if (!_equipEditando) return;
  await db.from('rdo_equipamentos').delete().eq('id', _equipEditando.id);
  $('folha-equip').hidden = true;
  await carregarEquipRDO();
});

// Atalho da faixa do dia: abre a folha do novo RDO já na lista,
// para o dia continuar sendo uma escolha visível e não um chute.
async function lancarHoje() {
  irPara('rdo');
  await carregarRDOs();
  abrirFolhaNovoRDO();
}

// As folhas do RDO também fecham no Escape.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  ['folha-atividade','folha-foto','folha-equip','folha-novo-rdo']
    .forEach(id => { $(id).hidden = true; });
});

ligarCamposDoRDO();
