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
  { ic: 'i-rdo',        nome: 'RDO',           desc: 'Diário de obra',      pronto: false },
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
  $('tela-painel').hidden  = tela !== 'painel';
  $('tela-efetivo').hidden = tela !== 'efetivo';
  $('btn-voltar').hidden   = tela === 'painel';
  renderModulos(_status);
  window.scrollTo(0, 0);
  if (tela === 'efetivo') carregarEfetivo();
}

$('btn-voltar').addEventListener('click', () => irPara('painel'));

/* ---------- abertura ---------- */
let _obras  = [];
let _obra   = null;
let _status = null;
let _funcoes = [];

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
    acao.push({ txt: 'Abrir o RDO de hoje', tipo: 'btn-secundario' });
  } else if (s.ultimo_rdo == null) {
    estado = 'pendente';
    titulo = 'Primeiro RDO da obra';
    linha  = `Nenhum diário lançado ainda em ${_obra.nome}.`;
    acao.push({ txt: 'Lançar o RDO de hoje', tipo: 'btn-primario' });
  } else if ((s.dias_sem_rdo || 0) >= 2) {
    estado = 'atrasado';
    titulo = `${plural(s.dias_sem_rdo, 'dia', 'dias')} sem RDO`;
    linha  = `O último foi o de ${dataBR(s.ultimo_rdo)}. Diário em atraso trava a medição.`;
    acao.push({ txt: 'Lançar o RDO de hoje', tipo: 'btn-primario' });
  } else {
    estado = 'pendente';
    titulo = 'RDO de hoje ainda não saiu';
    linha  = `O último foi o de ${dataBR(s.ultimo_rdo)}.`;
    acao.push({ txt: 'Lançar o RDO de hoje', tipo: 'btn-primario' });
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
    // Sem tela de RDO ainda: o botão avisa em vez de fingir que abriu.
    b.addEventListener('click', a.acao || (() => {
      b.textContent = 'Tela do RDO em construção';
      b.disabled = true;
    }));
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
      if (_tela === m.tela) b.setAttribute('aria-current', 'page');
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
