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
  { ic: 'i-efetivo',    nome: 'Efetivo',       desc: 'Pessoas e contratos', pronto: false, conta: 'efetivo_ativo' },
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

/* ---------- abertura ---------- */
let _obras = [];
let _obra  = null;

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
    db.from('vw_alertas').select('nome, funcao, tipo, vencimento, dias_restantes')
      .eq('obra', _obra.nome).order('dias_restantes', { ascending: true }).limit(20)
  ]);

  const s = st.data || {};
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

/* Nível pelo prazo: vencido ou até uma semana é grave — experiência
   de CLT perdida por um dia vira contrato por prazo indeterminado. */
function nivel(dias) {
  if (dias == null) return 'calmo';
  if (dias <= 7)  return 'grave';
  if (dias <= 15) return 'atencao';
  return 'calmo';
}
function prazoTexto(dias) {
  if (dias == null) return '—';
  if (dias < 0)  return plural(-dias, 'dia vencido', 'dias vencido');
  if (dias === 0) return 'hoje';
  return plural(dias, 'dia', 'dias');
}

function renderAlertas(lista) {
  const area = $('alertas-area');
  const botao = $('btn-todos-alertas');

  if (lista === null) {
    area.innerHTML = vazioHTML('Não consegui ler os alertas desta obra.');
    botao.hidden = true;
    return;
  }
  if (!lista.length) {
    area.innerHTML = vazioHTML(
      'Nenhum prazo de experiência ou viagem nos próximos dias.',
      'Assim que houver contrato ativo, os vencimentos aparecem aqui.');
    botao.hidden = true;
    return;
  }

  let mostrando = 5;
  const pintar = () => {
    area.innerHTML = '<div class="lista"></div>';
    const cx = area.firstElementChild;
    lista.slice(0, mostrando).forEach(a => {
      const l = document.createElement('div');
      l.className = 'linha';
      l.dataset.nivel = nivel(a.dias_restantes);

      const tarja = document.createElement('span'); tarja.className = 'tarja';
      const miolo = document.createElement('span'); miolo.className = 'miolo';
      const quem  = document.createElement('span'); quem.className = 'quem';
      quem.textContent = a.nome;
      const oque  = document.createElement('span'); oque.className = 'oque';
      oque.textContent = [a.tipo, a.funcao, a.vencimento ? dataBR(a.vencimento) : null]
        .filter(Boolean).join(' · ');
      miolo.append(quem, oque);
      const prazo = document.createElement('span'); prazo.className = 'prazo';
      prazo.textContent = prazoTexto(a.dias_restantes);

      l.append(tarja, miolo, prazo);
      cx.appendChild(l);
    });
    botao.hidden = lista.length <= mostrando;
    const faltam = lista.length - mostrando;
    botao.textContent = faltam === 1 ? 'Ver mais 1' : `Ver os ${faltam} restantes`;
  };
  botao.onclick = () => { mostrando = lista.length; pintar(); };
  pintar();
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
  $('folha-obra').hidden = true;
  $('folha-escolha').hidden = true;
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
