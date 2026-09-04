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
  { ic: 'i-alerta',     nome: 'Alertas',       desc: 'Prazos em 60 dias', pronto: true, tela: 'alertas' },
  { ic: 'i-epi',        nome: 'EPI',           desc: 'Ficha de entrega',    pronto: true, tela: 'epi', },
  { ic: 'i-ocorrencia', nome: 'Ocorrências',   desc: 'Segurança',           pronto: true, tela: 'ocorrencias', conta: 'ocorrencias_30_dias' },
  { ic: 'i-tarefa',     nome: 'Tarefas',       desc: 'Pauta e prazo',       pronto: true, tela: 'tarefas', conta: 'tarefas_abertas' },
  { ic: 'i-nf',         nome: 'Notas fiscais', desc: 'Cabeçalho e itens',   pronto: true, tela: 'nfs', },
  { ic: 'i-equip',      nome: 'Equipamentos',  desc: 'Frota e horas',       pronto: true, tela: 'equipamentos', conta: 'equipamentos_ativos' },
  { ic: 'i-medicao',    nome: 'Medições',      desc: 'Boletim e acumulado', pronto: true, tela: 'medicoes', },
  { ic: 'i-reuniao',    nome: 'Reuniões',      desc: 'Pauta e ata',         pronto: true, tela: 'reunioes', },
  { ic: 'i-doc',        nome: 'Documentos',    desc: 'Arquivos e mural',    pronto: true, tela: 'documentos', }
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
  $('tela-equipamentos').hidden = tela !== 'equipamentos';
  $('tela-ocorrencias').hidden  = tela !== 'ocorrencias';
  $('tela-tarefas').hidden = tela !== 'tarefas';
  $('tela-alertas').hidden = tela !== 'alertas';
  $('tela-nfs').hidden = tela !== 'nfs';
  $('tela-nf-edit').hidden = tela !== 'nf-edit';
  $('tela-documentos').hidden = tela !== 'documentos';
  $('tela-reunioes').hidden = tela !== 'reunioes';
  $('tela-ata').hidden = tela !== 'ata';
  $('tela-medicoes').hidden = tela !== 'medicoes';
  $('tela-contrato').hidden = tela !== 'contrato';
  $('tela-medicao').hidden  = tela !== 'medicao';
  $('tela-epi').hidden = tela !== 'epi';
  $('btn-voltar').hidden    = tela === 'painel';
  renderModulos(_status);
  window.scrollTo(0, 0);
  if (tela === 'efetivo') carregarEfetivo();
  if (tela === 'rdo')     carregarRDOs();
  if (tela === 'equipamentos') carregarEquipamentos();
  if (tela === 'ocorrencias')  carregarOcorrencias();
  if (tela === 'tarefas') carregarTarefas();
  if (tela === 'alertas') carregarAlertas();
  if (tela === 'nfs') carregarNFs();
  if (tela === 'documentos') carregarDocumentos();
  if (tela === 'reunioes') carregarReunioes();
  if (tela === 'medicoes') carregarMedicoes();
  if (tela === 'epi') carregarEPI();
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
  if (_tela === 'nf-edit') {
    _nf = null;
    irPara('nfs');
    await carregarPainel();
    return;
  }
  if (_tela === 'medicao')  { _medicao = null; irPara('contrato');
                              await abrirContrato(_contrato.id); return; }
  if (_tela === 'contrato') { _contrato = null; irPara('medicoes');
                              await carregarPainel(); return; }
  if (_tela === 'ata')      { _reuniao = null; irPara('reunioes');
                              await carregarPainel(); return; }
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
  await carregarAvisos();
  if (_tela === 'efetivo')      await carregarEfetivo();
  if (_tela === 'equipamentos') await carregarEquipamentos();
  if (_tela === 'rdo')          await carregarRDOs();
  if (_tela === 'ocorrencias')  await carregarOcorrencias();
  if (_tela === 'tarefas') await carregarTarefas();
  if (_tela === 'alertas') await carregarAlertas();
  if (_tela === 'nfs') await carregarNFs();
  if (_tela === 'documentos') await carregarDocumentos();
  if (_tela === 'reunioes') await carregarReunioes();
  if (_tela === 'medicoes') await carregarMedicoes();
  if (_tela === 'epi') await carregarEPI();
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
      sub: n(s.efetivo_ativo) ? 'com contrato de trabalho ativo' : 'ninguém cadastrado' },
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
      if (_tela === m.tela ||
          (_tela === 'rdo-edit' && m.tela === 'rdo') ||
          (_tela === 'nf-edit'  && m.tela === 'nfs') ||
          (['contrato','medicao'].includes(_tela) && m.tela === 'medicoes') ||
          (_tela === 'ata' && m.tela === 'reunioes'))
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

  if (error) {
    area.innerHTML = vazioHTML('Não consegui ler os diários.', error.message);
    $('cartao-chuva').hidden = true;
    $('cartao-calendario').hidden = true;
    return;
  }

  _rdos = data || [];
  carregarChuva();
  carregarCalendario();

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
  ['folha-atividade','folha-foto','folha-equip','folha-novo-rdo','folha-equipamento','folha-ocorrencia','folha-tarefa','folha-entrega','folha-epi',
   'folha-nova-nf','folha-item','folha-contrato','folha-ct-item',
   'folha-nova-medicao','folha-reuniao','folha-participante','folha-topico',
   'folha-documento','folha-recado','folha-busca','folha-avisos','folha-pedido']
    .forEach(id => { $(id).hidden = true; });
});

ligarCamposDoRDO();

/* ============================================================
   EQUIPAMENTOS — a frota da obra
   O prefixo é único no banco inteiro, não por obra: dois canteiros
   não podem chamar máquinas diferentes de ESC-01. E obra_id aceita
   ficar vazio, então existe frota que não está em obra nenhuma.
   ============================================================ */

const CATEGORIA_EQ  = { pesado:'Pesado', leve:'Leve', apoio:'Apoio', ferramenta:'Ferramenta' };
const PROPRIEDADE_EQ = { proprio:'Próprio', locado:'Locado' };

let _frota    = [];   // ativos desta obra
let _semObra  = [];   // ativos sem obra
let _foraFrota = [];  // inativos desta obra
let _disp     = {};   // disponibilidade do mês, por prefixo
let _eqEditando = null;

function mesAtualISO() { return hojeISO().slice(0, 8) + '01'; }

async function carregarEquipamentos() {
  $('eq-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('eq-lista');
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');

  const [daObra, soltos, inativos, disp] = await Promise.all([
    db.from('equipamentos').select('*').eq('obra_id', _obra.id).eq('ativo', true).order('prefixo'),
    db.from('equipamentos').select('*').is('obra_id', null).eq('ativo', true).order('prefixo'),
    db.from('equipamentos').select('*').eq('obra_id', _obra.id).eq('ativo', false).order('prefixo'),
    db.from('vw_disponibilidade_equipamento')
      .select('prefixo, horas_operando, horas_paradas, disponibilidade_pct')
      .eq('obra', _obra.codigo).eq('mes', mesAtualISO())
  ]);

  if (daObra.error) {
    area.innerHTML = vazioHTML('Não consegui ler a frota.', daObra.error.message);
    return;
  }

  _frota     = daObra.data || [];
  _semObra   = soltos.error   ? [] : (soltos.data   || []);
  _foraFrota = inativos.error ? [] : (inativos.data || []);

  _disp = {};
  (disp.error ? [] : (disp.data || [])).forEach(d => { _disp[d.prefixo] = d; });

  renderEqNumeros();
  filtrarEq();
  renderSemObra();
  renderForaFrota();
}

function nivelDisp(pct) {
  if (pct == null) return null;
  if (pct < 70) return 'baixa';
  if (pct < 90) return 'meia';
  return 'boa';
}

function renderEqNumeros() {
  const locados = _frota.filter(e => e.propriedade === 'locado').length;
  const comDado = _frota.map(e => _disp[e.prefixo]).filter(Boolean);
  const media = comDado.length
    ? Math.round(comDado.reduce((s, d) => s + Number(d.disponibilidade_pct || 0), 0) / comDado.length)
    : null;

  const tiles = [
    { rot: 'Na frota',      val: _frota.length,          sub: plural(_foraFrota.length, 'fora da frota', 'fora da frota') },
    { rot: 'Próprios',      val: _frota.length - locados, sub: 'da empresa' },
    { rot: 'Locados',       val: locados,                sub: locados ? 'de terceiros' : 'nenhum' },
    { rot: 'Disponib. do mês', val: media == null ? '—' : media + '%',
      sub: comDado.length ? plural(comDado.length, 'com apontamento', 'com apontamento') : 'sem horas no RDO',
      urgente: media != null && media < 70 }
  ];

  const area = $('eq-numeros');
  area.innerHTML = '';
  tiles.forEach(t => {
    const div = document.createElement('div');
    div.className = 'num';
    const rot = document.createElement('p'); rot.className = 'rotulo'; rot.textContent = t.rot;
    const val = document.createElement('b'); val.textContent = t.val;
    const sub = document.createElement('small'); sub.textContent = t.sub;
    if (t.urgente) sub.className = 'alerta';
    div.append(rot, val, sub);
    area.appendChild(div);
  });
}

function linhaEquipamento(e, opcoes) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pessoa' + (opcoes && opcoes.apagada ? ' baixada' : '');

  const tarja = document.createElement('span'); tarja.className = 'tarja';
  const pref  = document.createElement('span'); pref.className = 'pref'; pref.textContent = e.prefixo;

  const miolo = document.createElement('span'); miolo.className = 'miolo';
  const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = e.tipo;
  const sub = document.createElement('span'); sub.className = 'sub';
  sub.textContent = [e.marca, e.modelo, e.placa, e.ano,
                     e.propriedade === 'locado' ? e.fornecedor : null]
                    .filter(Boolean).join(' · ') || CATEGORIA_EQ[e.categoria];
  miolo.append(nm, sub);

  const lado = document.createElement('span'); lado.className = 'lado';
  const prop = document.createElement('span');
  prop.className = 'chip'; prop.dataset.prop = e.propriedade;
  prop.textContent = PROPRIEDADE_EQ[e.propriedade] || e.propriedade;
  lado.appendChild(prop);

  const d = _disp[e.prefixo];
  if (d && d.disponibilidade_pct != null) {
    const c = document.createElement('span');
    c.className = 'chip disp';
    c.dataset.nivel = nivelDisp(Number(d.disponibilidade_pct));
    c.textContent = Number(d.disponibilidade_pct).toLocaleString('pt-BR') + '% disp';
    lado.appendChild(c);
    if (nivelDisp(Number(d.disponibilidade_pct)) === 'baixa') b.dataset.nivel = 'grave';
  }

  b.append(tarja, pref, miolo, lado);
  b.addEventListener('click', () => abrirEquipamento(e));
  return b;
}

function filtrarEq() {
  const termo = ($('busca-eq').value || '').trim().toLowerCase();
  const vistos = termo
    ? _frota.filter(e => [e.prefixo, e.tipo, e.marca, e.modelo, e.placa]
        .filter(Boolean).join(' ').toLowerCase().includes(termo))
    : _frota;

  const area = $('eq-lista');

  if (!_frota.length) {
    area.innerHTML = vazioHTML('Nenhum equipamento nesta obra.',
      'Cadastre a frota aqui e ela passa a aparecer no RDO para apontar horas.');
    return;
  }
  if (!vistos.length) {
    area.innerHTML = vazioHTML('Nenhum equipamento encontrado com "' + termo + '".');
    return;
  }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  vistos.forEach(e => cx.appendChild(linhaEquipamento(e)));
}

$('busca-eq').addEventListener('input', filtrarEq);

function renderSemObra() {
  $('bloco-sem-obra').hidden = !_semObra.length;
  if (!_semObra.length) return;
  $('btn-sem-obra').textContent = 'Sem obra (' + _semObra.length + ')';
  const area = $('sem-obra-lista');
  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  _semObra.forEach(e => cx.appendChild(linhaEquipamento(e)));
}

function renderForaFrota() {
  $('bloco-fora-frota').hidden = !_foraFrota.length;
  if (!_foraFrota.length) return;
  $('btn-fora-frota').textContent = 'Fora da frota (' + _foraFrota.length + ')';
  const area = $('fora-frota-lista');
  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  _foraFrota.forEach(e => cx.appendChild(linhaEquipamento(e, { apagada: true })));
}

[['btn-sem-obra','sem-obra-lista'], ['btn-fora-frota','fora-frota-lista']].forEach(([bt, lst]) => {
  $(bt).addEventListener('click', () => {
    const area = $(lst);
    area.hidden = !area.hidden;
    $(bt).setAttribute('aria-expanded', String(!area.hidden));
  });
});

/* ---------- folha ---------- */
// Fornecedor só faz sentido em equipamento locado. Campo que não se
// aplica atrapalha mais do que ajuda.
function alternarFornecedor() {
  $('campo-fornecedor').hidden = $('q-propriedade').value !== 'locado';
}
$('q-propriedade').addEventListener('change', alternarFornecedor);

function abrirEquipamento(e) {
  _eqEditando = e || null;
  $('titulo-equipamento').textContent = e ? e.prefixo : 'Novo equipamento';
  $('q-prefixo').value     = e ? e.prefixo : '';
  $('q-tipo').value        = e ? e.tipo : '';
  $('q-categoria').value   = e ? e.categoria : 'pesado';
  $('q-propriedade').value = e ? e.propriedade : 'proprio';
  $('q-fornecedor').value  = e && e.fornecedor ? e.fornecedor : '';
  $('q-marca').value       = e && e.marca ? e.marca : '';
  $('q-modelo').value      = e && e.modelo ? e.modelo : '';
  $('q-placa').value       = e && e.placa ? e.placa : '';
  $('q-ano').value         = e && e.ano ? e.ano : '';
  $('q-nesta-obra').checked = e ? e.obra_id === _obra.id : true;

  $('btn-tirar-frota').hidden   = !e || !e.ativo;
  $('btn-voltar-frota').hidden  = !e || e.ativo;
  $('erro-equipamento').hidden = true;
  alternarFornecedor();
  $('folha-equipamento').hidden = false;
  if (!e) $('q-prefixo').focus();
}

$('btn-novo-equipamento').addEventListener('click', () => abrirEquipamento(null));
$('btn-fechar-equipamento').addEventListener('click', () => { $('folha-equipamento').hidden = true; });
$('folha-equipamento').addEventListener('click', (ev) => {
  if (ev.target === $('folha-equipamento')) $('folha-equipamento').hidden = true;
});

$('form-equipamento').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-equipamento');
  const botao = $('btn-salvar-equipamento');
  erro.hidden = true;

  const prefixo = $('q-prefixo').value.trim().toUpperCase();
  const tipo    = $('q-tipo').value.trim();
  if (!prefixo) return falhar(erro, 'O prefixo é obrigatório — é por ele que a máquina é chamada na obra.');
  if (!tipo)    return falhar(erro, 'Diga o tipo do equipamento.');

  const ano = $('q-ano').value === '' ? null : Number($('q-ano').value);
  if (ano != null && (ano < 1950 || ano > 2100))
    return falhar(erro, 'O ano parece errado. Confira.');

  const locado = $('q-propriedade').value === 'locado';
  const linha = {
    prefixo, tipo,
    categoria:   $('q-categoria').value,
    propriedade: $('q-propriedade').value,
    fornecedor:  locado ? ($('q-fornecedor').value.trim() || null) : null,
    marca:  $('q-marca').value.trim()  || null,
    modelo: $('q-modelo').value.trim() || null,
    placa:  $('q-placa').value.trim().toUpperCase() || null,
    ano,
    obra_id: $('q-nesta-obra').checked ? _obra.id : null
  };

  botao.disabled = true; botao.textContent = 'Salvando…';
  const { error } = _eqEditando
    ? await db.from('equipamentos').update(linha).eq('id', _eqEditando.id)
    : await db.from('equipamentos').insert({ ...linha, ativo: true });
  botao.disabled = false; botao.textContent = 'Salvar';

  if (error) {
    // O prefixo é único no banco INTEIRO. Vale dizer isso: quem lê
    // pensaria que a briga é só dentro da obra.
    return falhar(erro, /equipamentos_prefixo_key/.test(error.message)
      ? `Já existe um equipamento com o prefixo ${prefixo} — o prefixo é único em todas as obras, não só nesta.`
      : 'Não consegui salvar: ' + error.message);
  }

  $('folha-equipamento').hidden = true;
  await carregarEquipamentos();
  await carregarPainel();
});

// Baixa lógica: tirar da frota não apaga. O equipamento pode ter horas
// lançadas em RDO antigo, e apagar levaria o histórico junto.
async function mudarFrota(ativo) {
  if (!_eqEditando) return;
  const { error } = await db.from('equipamentos').update({ ativo }).eq('id', _eqEditando.id);
  if (error) return falhar($('erro-equipamento'), 'Não consegui alterar: ' + error.message);
  $('folha-equipamento').hidden = true;
  await carregarEquipamentos();
  await carregarPainel();
}
$('btn-tirar-frota').addEventListener('click', () => mudarFrota(false));
$('btn-voltar-frota').addEventListener('click', () => mudarFrota(true));

/* ============================================================
   OCORRÊNCIAS — segurança e disciplina
   A tabela não tem obra_id: a ocorrência pertence à obra através
   do contrato ou do RDO. E chk_ocorrencia_vinculo exige um dos
   dois — ocorrência solta no banco não existe. Por isso a tela
   começa perguntando "sobre quem".
   ============================================================ */

const TIPOS_OC = [
  ['acidente_com_afastamento',  'Acidente com afastamento', 'grave'],
  ['acidente_sem_afastamento',  'Acidente sem afastamento', 'grave'],
  ['quase_acidente',            'Quase acidente',           'atencao'],
  ['desvio_comportamental',     'Desvio comportamental',    'atencao'],
  ['advertencia_verbal',        'Advertência verbal',       'atencao'],
  ['advertencia_escrita',       'Advertência escrita',      'atencao'],
  ['suspensao',                 'Suspensão',                'grave'],
  ['elogio',                    'Elogio',                   'bom']
];
const NOME_TIPO_OC = Object.fromEntries(TIPOS_OC.map(t => [t[0], t[1]]));
const PESO_TIPO_OC = Object.fromEntries(TIPOS_OC.map(t => [t[0], t[2]]));
const GRAVIDADE_OC = { baixa:'Baixa', media:'Média', alta:'Alta', critica:'Crítica' };

// Dias de afastamento só existe onde faz sentido. Campo que não se
// aplica é campo que alguém preenche errado.
const TEM_AFASTAMENTO = ['acidente_com_afastamento', 'suspensao'];

let _ocorrencias = [];
let _ocEditando = null;

async function carregarOcorrencias() {
  $('oc-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('oc-lista');
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');

  // Duas consultas porque o vínculo é um ou outro: as ligadas a pessoa
  // chegam pelo contrato, e as ligadas só ao dia chegam pelo RDO.
  const campos = 'id, data, tipo, gravidade, descricao, acao_tomada, ' +
                 'dias_afastamento, registrado_por, contrato_id, rdo_id';
  const [porPessoa, porDia] = await Promise.all([
    db.from('ocorrencias')
      .select(campos + ', contrato:contratos!inner(id, obra_id, pessoa:pessoas(nome), funcao:funcoes(nome))')
      .eq('contrato.obra_id', _obra.id).order('data', { ascending: false }).limit(300),
    db.from('ocorrencias')
      .select(campos + ', rdo:rdos!inner(id, numero, data, obra_id)')
      .eq('rdo.obra_id', _obra.id).is('contrato_id', null)
      .order('data', { ascending: false }).limit(300)
  ]);

  if (porPessoa.error && porDia.error) {
    area.innerHTML = vazioHTML('Não consegui ler as ocorrências.', porPessoa.error.message);
    return;
  }

  _ocorrencias = [...(porPessoa.data || []), ...(porDia.data || [])]
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

  renderOcNumeros();
  filtrarOc();
}

function diasAtras(n) {
  const d = new Date(hojeISO() + 'T00:00:00');
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function renderOcNumeros() {
  const d30  = diasAtras(30);
  const d365 = diasAtras(365);
  const em30 = _ocorrencias.filter(o => o.data >= d30);
  const acidentes12m = _ocorrencias.filter(o =>
    o.data >= d365 && o.tipo.startsWith('acidente_'));
  const afast = _ocorrencias.filter(o => o.data >= d365)
    .reduce((s, o) => s + Number(o.dias_afastamento || 0), 0);
  const quase90 = _ocorrencias.filter(o =>
    o.data >= diasAtras(90) && o.tipo === 'quase_acidente').length;

  const comAfast = acidentes12m.filter(o => o.tipo === 'acidente_com_afastamento').length;

  const tiles = [
    { rot: 'Últimos 30 dias', val: em30.length,
      sub: em30.length ? plural(em30.filter(o=>o.tipo==='elogio').length, 'elogio', 'elogios') : 'nada registrado' },
    { rot: 'Acidentes · 12 m', val: acidentes12m.length,
      sub: comAfast ? plural(comAfast, 'com afastamento', 'com afastamento') : 'nenhum com afastamento',
      urgente: comAfast > 0 },
    { rot: 'Dias de afastamento', val: afast, sub: 'nos últimos 12 meses', urgente: afast > 0 },
    { rot: 'Quase acidentes · 90 d', val: quase90,
      sub: quase90 ? 'cada um é um aviso' : 'nenhum registrado' }
  ];

  const area = $('oc-numeros');
  area.innerHTML = '';
  tiles.forEach(t => {
    const div = document.createElement('div');
    div.className = 'num';
    const rot = document.createElement('p'); rot.className = 'rotulo'; rot.textContent = t.rot;
    const val = document.createElement('b'); val.textContent = t.val;
    const sub = document.createElement('small'); sub.textContent = t.sub;
    if (t.urgente) sub.className = 'alerta';
    div.append(rot, val, sub);
    area.appendChild(div);
  });
}

function quemDaOcorrencia(o) {
  if (o.contrato && o.contrato.pessoa) return o.contrato.pessoa.nome;
  if (o.rdo) return 'A obra — RDO nº ' + o.rdo.numero;
  return 'A obra';
}

function filtrarOc() {
  const termo = ($('busca-oc').value || '').trim().toLowerCase();
  const vistos = termo
    ? _ocorrencias.filter(o => [quemDaOcorrencia(o), NOME_TIPO_OC[o.tipo], o.descricao]
        .filter(Boolean).join(' ').toLowerCase().includes(termo))
    : _ocorrencias;

  const area = $('oc-lista');

  if (!_ocorrencias.length) {
    area.innerHTML = vazioHTML('Nenhuma ocorrência registrada nesta obra.',
      'Registre também quase acidente e elogio: o histórico de segurança não é só o que deu errado.');
    return;
  }
  if (!vistos.length) {
    area.innerHTML = vazioHTML('Nada encontrado com "' + termo + '".');
    return;
  }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;

  vistos.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pessoa';
    const peso = PESO_TIPO_OC[o.tipo];
    if (peso === 'grave')   b.dataset.nivel = 'grave';
    if (peso === 'atencao') b.dataset.nivel = 'atencao';

    const tarja = document.createElement('span'); tarja.className = 'tarja';

    const miolo = document.createElement('span'); miolo.className = 'miolo';
    const nm = document.createElement('span'); nm.className = 'nm';
    nm.textContent = quemDaOcorrencia(o);
    const sub = document.createElement('span'); sub.className = 'sub';
    sub.textContent = [NOME_TIPO_OC[o.tipo] || o.tipo,
                       o.contrato && o.contrato.funcao ? o.contrato.funcao.nome : null,
                       Number(o.dias_afastamento) ? plural(Number(o.dias_afastamento), 'dia de afastamento', 'dias de afastamento') : null]
                      .filter(Boolean).join(' · ');
    const desc = document.createElement('span'); desc.className = 'desc';
    desc.textContent = o.descricao;
    miolo.append(nm, sub, desc);

    const lado = document.createElement('span'); lado.className = 'lado';
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.grav = o.tipo === 'elogio' ? 'elogio' : (o.gravidade || '');
    chip.textContent = o.tipo === 'elogio' ? 'Elogio' : (GRAVIDADE_OC[o.gravidade] || '—');
    const quando = document.createElement('span'); quando.className = 'quando';
    quando.textContent = dataBR(o.data);
    lado.append(chip, quando);

    b.append(tarja, miolo, lado);
    b.addEventListener('click', () => abrirOcorrencia(o));
    cx.appendChild(b);
  });
}

$('busca-oc').addEventListener('input', filtrarOc);

/* ---------- folha da ocorrência ---------- */

// O vínculo é a primeira pergunta porque o banco não aceita ocorrência
// solta: ou é de uma pessoa, ou é do dia. A lista traz o efetivo ativo
// mais a opção da obra.
async function pintarVinculos(escolhido) {
  const sel = $('o-vinculo');
  sel.innerHTML = '';

  const oObra = document.createElement('option');
  oObra.value = 'obra';
  oObra.textContent = 'A obra — sem pessoa específica';
  sel.appendChild(oObra);

  if (!_efetivo.length) await carregarEfetivoSilencioso();

  const g = document.createElement('optgroup');
  g.label = 'Pessoas do efetivo';
  _efetivo.forEach(p => {
    const o = document.createElement('option');
    o.value = p.contrato_id;
    o.textContent = p.nome + ' · ' + p.funcao;
    g.appendChild(o);
  });
  if (_efetivo.length) sel.appendChild(g);

  sel.value = escolhido || 'obra';
}

// O efetivo pode não ter sido carregado ainda se a pessoa entrou direto
// em Ocorrências. Busco sem mexer na tela do efetivo.
async function carregarEfetivoSilencioso() {
  const { data } = await db.from('vw_efetivo')
    .select('contrato_id, nome, funcao').eq('obra', _obra.codigo).order('nome');
  _efetivo = data || [];
}

function pintarTiposOc(escolhido) {
  const sel = $('o-tipo');
  sel.innerHTML = '<option value="">— escolha —</option>';
  TIPOS_OC.forEach(([v, rot]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = rot;
    if (v === escolhido) o.selected = true;
    sel.appendChild(o);
  });
}

function ajustarCamposOc() {
  const tipo = $('o-tipo').value;
  $('campo-afastamento').hidden = !TEM_AFASTAMENTO.includes(tipo);
  if ($('campo-afastamento').hidden) $('o-dias').value = 0;
  // Elogio não tem gravidade. Deixar o seletor lá convida a preencher
  // uma coisa que não quer dizer nada.
  const eElogio = tipo === 'elogio';
  $('o-gravidade').disabled = eElogio;
  if (eElogio) $('o-gravidade').value = '';
}
$('o-tipo').addEventListener('change', ajustarCamposOc);

// Ocorrência da obra precisa do RDO daquele dia — é o que o banco aceita
// como vínculo. Se não houver diário, aviso em vez de deixar salvar e
// estourar erro de constraint.
async function conferirVinculoObra() {
  const aviso = $('aviso-vinculo');
  if ($('o-vinculo').value !== 'obra' || !$('o-data').value) { aviso.hidden = true; return null; }

  const { data } = await db.from('rdos').select('id, numero')
    .eq('obra_id', _obra.id).eq('data', $('o-data').value).maybeSingle();

  if (!data) {
    aviso.textContent = `Não há RDO do dia ${dataBR($('o-data').value)}. ` +
      'Ocorrência da obra se prende ao diário daquele dia: lance o RDO primeiro, ' +
      'ou escolha a pessoa envolvida.';
    aviso.hidden = false;
    return null;
  }
  aviso.textContent = `Vai ficar ligada ao RDO nº ${data.numero}, do dia ${dataBR(data.data || $('o-data').value)}.`;
  aviso.hidden = false;
  return data.id;
}
$('o-vinculo').addEventListener('change', conferirVinculoObra);
$('o-data').addEventListener('change', conferirVinculoObra);

async function abrirOcorrencia(o) {
  _ocEditando = o || null;
  $('titulo-ocorrencia').textContent = o ? 'Ocorrência' : 'Nova ocorrência';
  await pintarVinculos(o ? (o.contrato_id || 'obra') : 'obra');
  pintarTiposOc(o ? o.tipo : '');
  $('o-data').value        = o ? o.data : hojeISO();
  $('o-data').max          = hojeISO();
  $('o-gravidade').value   = o && o.gravidade ? o.gravidade : '';
  $('o-dias').value        = o ? Number(o.dias_afastamento || 0) : 0;
  $('o-descricao').value   = o ? o.descricao : '';
  $('o-acao').value        = o && o.acao_tomada ? o.acao_tomada : '';
  $('o-registrador').value = o ? (o.registrado_por || '') : (_perfilNome || '');
  $('btn-apagar-ocorrencia').hidden = !o;
  $('erro-ocorrencia').hidden = true;
  ajustarCamposOc();
  await conferirVinculoObra();
  $('folha-ocorrencia').hidden = false;
}

$('btn-nova-ocorrencia').addEventListener('click', () => abrirOcorrencia(null));
$('btn-fechar-ocorrencia').addEventListener('click', () => { $('folha-ocorrencia').hidden = true; });
$('folha-ocorrencia').addEventListener('click', (ev) => {
  if (ev.target === $('folha-ocorrencia')) $('folha-ocorrencia').hidden = true;
});

$('form-ocorrencia').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro  = $('erro-ocorrencia');
  const botao = $('btn-salvar-ocorrencia');
  erro.hidden = true;

  const tipo      = $('o-tipo').value;
  const descricao = $('o-descricao').value.trim();
  const data      = $('o-data').value;

  if (!tipo)      return falhar(erro, 'Escolha o tipo da ocorrência.');
  if (!data)      return falhar(erro, 'Informe a data.');
  if (data > hojeISO()) return falhar(erro, 'Não dá para registrar ocorrência de um dia que ainda não chegou.');
  if (!descricao) return falhar(erro, 'Descreva o que aconteceu.');

  const eObra = $('o-vinculo').value === 'obra';
  let rdoId = null;
  if (eObra) {
    rdoId = await conferirVinculoObra();
    if (!rdoId) return falhar(erro,
      'Sem RDO nesse dia, a ocorrência da obra não tem onde se prender. ' +
      'Lance o diário primeiro, ou escolha a pessoa envolvida.');
  }

  const dias = TEM_AFASTAMENTO.includes(tipo) ? Number($('o-dias').value || 0) : 0;
  if (dias < 0 || dias > 365) return falhar(erro, 'Dias de afastamento vai de 0 a 365.');

  const linha = {
    contrato_id: eObra ? null : $('o-vinculo').value,
    rdo_id:      eObra ? rdoId : null,
    data, tipo,
    gravidade:        tipo === 'elogio' ? null : ($('o-gravidade').value || null),
    descricao,
    acao_tomada:      $('o-acao').value.trim() || null,
    dias_afastamento: dias,
    registrado_por:   $('o-registrador').value.trim() || null
  };

  botao.disabled = true; botao.textContent = 'Salvando…';
  const { error } = _ocEditando
    ? await db.from('ocorrencias').update(linha).eq('id', _ocEditando.id)
    : await db.from('ocorrencias').insert(linha);
  botao.disabled = false; botao.textContent = 'Salvar';

  if (error) {
    return falhar(erro, /chk_ocorrencia_vinculo/.test(error.message)
      ? 'A ocorrência precisa estar ligada a uma pessoa ou a um dia com RDO.'
      : 'Não consegui salvar: ' + error.message);
  }

  $('folha-ocorrencia').hidden = true;
  await carregarOcorrencias();
  await carregarPainel();
});

$('btn-apagar-ocorrencia').addEventListener('click', async () => {
  if (!_ocEditando) return;
  const { error } = await db.from('ocorrencias').delete().eq('id', _ocEditando.id);
  if (error) return falhar($('erro-ocorrencia'), 'Não consegui apagar: ' + error.message);
  $('folha-ocorrencia').hidden = true;
  await carregarOcorrencias();
  await carregarPainel();
});

/* ============================================================
   TAREFAS
   O status manda no que aparece: aberta e em andamento primeiro,
   porque é o que exige alguma coisa de alguém hoje.
   ============================================================ */

const STATUS_TF = {
  aberta:'Aberta', em_andamento:'Em andamento', concluida:'Concluída', cancelada:'Cancelada'
};
const PRIORIDADE_TF = { baixa:'Baixa', media:'Média', alta:'Alta' };
const SETORES = ['Suprimentos','Transporte','Planejamento','Administração','Segurança',
                 'Produção','Qualidade','Meio ambiente'];

let _tarefas = [];
let _tfFiltro = 'pendentes';
let _tfEditando = null;

async function carregarTarefas() {
  $('tf-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('tf-lista');
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');
  const { data, error } = await db.from('tarefas')
    .select('id, assunto, descricao, criador, responsavel, setor, prioridade, status, ' +
            'data_lancamento, data_termino, concluido_em, origem')
    .eq('obra_id', _obra.id).order('data_lancamento', { ascending: false }).limit(400);

  if (error) { area.innerHTML = vazioHTML('Não consegui ler as tarefas.', error.message); return; }

  _tarefas = data || [];
  carregarPedidos();
  renderTfNumeros();
  renderTfFiltros();
  filtrarTarefas();
}

const tfPendente = (t) => t.status === 'aberta' || t.status === 'em_andamento';
const tfAtrasada = (t) => tfPendente(t) && t.data_termino && t.data_termino < hojeISO();

function renderTfNumeros() {
  const pend = _tarefas.filter(tfPendente);
  const atr  = _tarefas.filter(tfAtrasada);
  const alta = pend.filter(t => t.prioridade === 'alta').length;
  const conc30 = _tarefas.filter(t =>
    t.status === 'concluida' && t.concluido_em && t.concluido_em.slice(0,10) >= diasAtras(30)).length;

  const tiles = [
    { rot:'Abertas', val: pend.length, sub: pend.length ? 'exigem alguém' : 'nada pendente' },
    { rot:'Atrasadas', val: atr.length, sub: atr.length ? 'passaram do prazo' : 'nenhuma no vermelho',
      urgente: atr.length > 0 },
    { rot:'Prioridade alta', val: alta, sub: alta ? 'entre as abertas' : 'nenhuma' },
    { rot:'Concluídas · 30 d', val: conc30, sub: 'no último mês' }
  ];
  const area = $('tf-numeros'); area.innerHTML = '';
  tiles.forEach(t => {
    const d = document.createElement('div'); d.className = 'num';
    const r = document.createElement('p'); r.className='rotulo'; r.textContent=t.rot;
    const v = document.createElement('b'); v.textContent=t.val;
    const s = document.createElement('small'); s.textContent=t.sub;
    if (t.urgente) s.className='alerta';
    d.append(r,v,s); area.appendChild(d);
  });
}

function renderTfFiltros() {
  const opcoes = [
    ['pendentes', 'Pendentes', _tarefas.filter(tfPendente).length],
    ['atrasadas', 'Atrasadas', _tarefas.filter(tfAtrasada).length],
    ['concluida', 'Concluídas', _tarefas.filter(t=>t.status==='concluida').length],
    ['todas',     'Todas',      _tarefas.length]
  ];
  const area = $('tf-filtros'); area.innerHTML = '';
  opcoes.forEach(([v, rot, n]) => {
    const b = document.createElement('button');
    b.type='button'; b.className='filtro';
    b.setAttribute('aria-pressed', String(_tfFiltro === v));
    b.textContent = rot + ' (' + n + ')';
    b.addEventListener('click', () => { _tfFiltro = v; renderTfFiltros(); filtrarTarefas(); });
    area.appendChild(b);
  });
}

function filtrarTarefas() {
  const termo = ($('busca-tf').value || '').trim().toLowerCase();
  let vistos = _tarefas;
  if (_tfFiltro === 'pendentes') vistos = vistos.filter(tfPendente);
  if (_tfFiltro === 'atrasadas') vistos = vistos.filter(tfAtrasada);
  if (_tfFiltro === 'concluida') vistos = vistos.filter(t => t.status === 'concluida');
  if (termo) vistos = vistos.filter(t =>
    [t.assunto, t.responsavel, t.setor, t.descricao].filter(Boolean).join(' ')
      .toLowerCase().includes(termo));

  const area = $('tf-lista');
  if (!_tarefas.length) {
    area.innerHTML = vazioHTML('Nenhuma tarefa nesta obra.',
      'Tarefa é o que ficou combinado e precisa de alguém e de uma data.');
    return;
  }
  if (!vistos.length) { area.innerHTML = vazioHTML('Nada neste filtro.'); return; }

  // Pendente antes de encerrada, e dentro disso o prazo mais curto primeiro.
  vistos = vistos.slice().sort((a, b) => {
    if (tfPendente(a) !== tfPendente(b)) return tfPendente(a) ? -1 : 1;
    const pa = a.data_termino || '9999-12-31', pb = b.data_termino || '9999-12-31';
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  vistos.forEach(t => {
    const b = document.createElement('button');
    b.type='button'; b.className='pessoa' + (tfPendente(t) ? '' : ' encerrada');
    if (tfAtrasada(t)) b.dataset.nivel = 'grave';
    else if (tfPendente(t) && t.prioridade === 'alta') b.dataset.nivel = 'atencao';

    const tarja = document.createElement('span'); tarja.className='tarja';
    const miolo = document.createElement('span'); miolo.className='miolo';
    const nm = document.createElement('span'); nm.className='nm'; nm.textContent = t.assunto;
    const sub = document.createElement('span'); sub.className='sub';
    sub.textContent = [t.responsavel, t.setor,
      t.data_termino ? (tfAtrasada(t) ? 'venceu em ' : 'prazo ') + dataBR(t.data_termino) : null]
      .filter(Boolean).join(' · ') || 'sem responsável definido';
    miolo.append(nm, sub);

    const lado = document.createElement('span'); lado.className='lado';
    const st = document.createElement('span'); st.className='chip'; st.dataset.st = t.status;
    st.textContent = STATUS_TF[t.status] || t.status;
    lado.appendChild(st);
    if (tfPendente(t)) {
      const pr = document.createElement('span'); pr.className='chip'; pr.dataset.prio = t.prioridade;
      pr.textContent = PRIORIDADE_TF[t.prioridade] || t.prioridade;
      lado.appendChild(pr);
    }
    b.append(tarja, miolo, lado);
    b.addEventListener('click', () => abrirTarefa(t));
    cx.appendChild(b);
  });
}

$('busca-tf').addEventListener('input', filtrarTarefas);

function pintarSetores(escolhido) {
  const sel = $('t-setor');
  sel.innerHTML = '<option value="">— sem setor —</option>';
  const lista = SETORES.slice();
  if (escolhido && !lista.includes(escolhido)) lista.push(escolhido);
  lista.sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(s => {
    const o = document.createElement('option'); o.value=s; o.textContent=s;
    if (s === escolhido) o.selected = true;
    sel.appendChild(o);
  });
}

// A data de conclusão é carimbada pelo banco quando o status vira
// concluída. Aviso na tela para ninguém procurar um campo que não existe.
function avisarTarefa() {
  const av = $('aviso-tarefa');
  const st = $('t-status').value;
  if (st === 'concluida') {
    av.textContent = 'Ao salvar como concluída, o banco carimba a data e a hora sozinho.';
    av.hidden = false;
  } else { av.hidden = true; }
}
$('t-status').addEventListener('change', avisarTarefa);

function abrirTarefa(t) {
  _tfEditando = t || null;
  $('titulo-tarefa').textContent = t ? 'Tarefa' : 'Nova tarefa';
  $('t-assunto').value     = t ? t.assunto : '';
  $('t-descricao').value   = t && t.descricao ? t.descricao : '';
  $('t-responsavel').value = t && t.responsavel ? t.responsavel : '';
  $('t-criador').value     = t ? (t.criador || '') : (_perfilNome || '');
  pintarSetores(t ? t.setor : null);
  $('t-prioridade').value  = t ? t.prioridade : 'media';
  $('t-status').value      = t ? t.status : 'aberta';
  $('t-lancamento').value  = t ? t.data_lancamento : hojeISO();
  $('t-termino').value     = t && t.data_termino ? t.data_termino : '';
  $('btn-apagar-tarefa').hidden = !t;
  $('erro-tarefa').hidden = true;
  avisarTarefa();
  $('folha-tarefa').hidden = false;
  if (!t) $('t-assunto').focus();
}

$('btn-nova-tarefa').addEventListener('click', () => abrirTarefa(null));
$('btn-fechar-tarefa').addEventListener('click', () => { $('folha-tarefa').hidden = true; });
$('folha-tarefa').addEventListener('click', (ev) => {
  if (ev.target === $('folha-tarefa')) $('folha-tarefa').hidden = true;
});

$('form-tarefa').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-tarefa'); erro.hidden = true;
  const assunto = $('t-assunto').value.trim();
  if (!assunto) return falhar(erro, 'A tarefa precisa de um assunto.');

  const lanc = $('t-lancamento').value || hojeISO();
  const prazo = $('t-termino').value || null;
  if (prazo && prazo < lanc)
    return falhar(erro, 'O prazo não pode ser antes da data de lançamento.');

  // concluido_em não vai daqui: é o gatilho do banco que carimba.
  const linha = {
    assunto,
    descricao:   $('t-descricao').value.trim() || null,
    criador:     $('t-criador').value.trim() || null,
    responsavel: $('t-responsavel').value.trim() || null,
    setor:       $('t-setor').value || null,
    prioridade:  $('t-prioridade').value,
    status:      $('t-status').value,
    data_lancamento: lanc,
    data_termino:    prazo
  };

  const { error } = _tfEditando
    ? await db.from('tarefas').update(linha).eq('id', _tfEditando.id)
    : await db.from('tarefas').insert({ ...linha, obra_id: _obra.id, origem: 'pauta' });

  if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  $('folha-tarefa').hidden = true;
  await carregarTarefas();
  await carregarPainel();
});

$('btn-apagar-tarefa').addEventListener('click', async () => {
  if (!_tfEditando) return;
  const { error } = await db.from('tarefas').delete().eq('id', _tfEditando.id);
  if (error) return falhar($('erro-tarefa'), 'Não consegui apagar: ' + error.message);
  $('folha-tarefa').hidden = true;
  await carregarTarefas();
  await carregarPainel();
});

/* ============================================================
   ALERTAS
   A vw_alertas só enxerga 7 dias — é a janela do painel. Aqui a
   conta é refeita sobre o efetivo até 60 dias, que é o prazo em
   que ainda dá para agir: marcar viagem, decidir a experiência.
   ============================================================ */
const HORIZONTE_ALERTA = 60;

async function carregarAlertas() {
  $('al-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('al-lista');
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');
  const { data, error } = await db.from('vw_efetivo')
    .select('contrato_id, nome, funcao, fim_experiencia_1, fim_experiencia_2, proxima_viagem, regime')
    .eq('obra', _obra.codigo).order('nome');

  if (error) { area.innerHTML = vazioHTML('Não consegui ler o efetivo.', error.message); return; }

  const linhas = [];
  (data || []).forEach(p => {
    const junta = (rot, iso) => {
      const d = diasAte(iso);
      if (d == null || d > HORIZONTE_ALERTA || d < -30) return;
      linhas.push({ nome: p.nome, funcao: p.funcao, rot, vencimento: iso, dias: d });
    };
    junta('Experiência 45 dias', p.fim_experiencia_1);
    junta('Experiência 90 dias', p.fim_experiencia_2);
    junta('Viagem', p.proxima_viagem);
  });
  linhas.sort((a, b) => a.dias - b.dias);

  renderAlNumeros(linhas);

  if (!linhas.length) {
    area.innerHTML = vazioHTML(
      `Nenhum prazo nos próximos ${HORIZONTE_ALERTA} dias.`,
      'Experiência e viagem aparecem aqui conforme o efetivo for entrando.');
    return;
  }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  linhas.forEach(a => {
    const l = document.createElement('div'); l.className = 'linha';
    l.dataset.nivel = a.dias <= 3 ? 'grave' : a.dias <= 7 ? 'atencao' : 'calmo';
    const tarja = document.createElement('span'); tarja.className='tarja';
    const miolo = document.createElement('span'); miolo.className='miolo';
    const quem = document.createElement('span'); quem.className='quem'; quem.textContent = a.nome;
    const oque = document.createElement('span'); oque.className='oque';
    oque.textContent = [a.rot, a.funcao, dataBR(a.vencimento)].filter(Boolean).join(' · ');
    miolo.append(quem, oque);
    const prazo = document.createElement('span'); prazo.className='prazo';
    prazo.textContent = prazoTexto(a.dias);
    l.append(tarja, miolo, prazo);
    cx.appendChild(l);
  });
}

function renderAlNumeros(linhas) {
  const ate7  = linhas.filter(a => a.dias <= 7).length;
  const ate30 = linhas.filter(a => a.dias <= 30).length;
  const exp   = linhas.filter(a => a.rot.startsWith('Experiência')).length;
  const viag  = linhas.filter(a => a.rot === 'Viagem').length;
  const tiles = [
    { rot:'Até 7 dias',  val: ate7,  sub: ate7 ? 'decidir agora' : 'nada urgente', urgente: ate7>0 },
    { rot:'Até 30 dias', val: ate30, sub: 'dá para programar' },
    { rot:'Experiência', val: exp,   sub: '45 e 90 dias' },
    { rot:'Viagem',      val: viag,  sub: 'giro do alojamento' }
  ];
  const area = $('al-numeros'); area.innerHTML='';
  tiles.forEach(t => {
    const d = document.createElement('div'); d.className='num';
    const r = document.createElement('p'); r.className='rotulo'; r.textContent=t.rot;
    const v = document.createElement('b'); v.textContent=t.val;
    const s = document.createElement('small'); s.textContent=t.sub;
    if (t.urgente) s.className='alerta';
    d.append(r,v,s); area.appendChild(d);
  });
}

/* ============================================================
   EPI — ficha de entrega
   O catálogo de EPI é do banco inteiro; a entrega é por contrato.
   A troca prevista sai da vw_ficha_epi: data da entrega mais os
   dias de validade da peça.
   ============================================================ */

const MOTIVO_EPI = {
  primeira_entrega:'Primeira entrega', troca:'Troca',
  danificado:'Danificado', perda:'Perda', vencimento:'Vencimento'
};

let _fichas = [];
let _catalogo = [];
let _epiFiltro = 'todas';
let _entregaEditando = null;
let _epiCatEditando = null;

async function carregarEPI() {
  $('epi-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('epi-lista');
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');
  const [fichas, cat] = await Promise.all([
    db.from('vw_ficha_epi')
      .select('contrato_id, nome, epi, ca, data_entrega, quantidade, motivo, assinatura_ok, troca_prevista')
      .eq('obra', _obra.codigo).order('data_entrega', { ascending: false }).limit(500),
    db.from('epis').select('id, nome, ca, validade_uso_dias, ativo').order('nome')
  ]);

  if (fichas.error) { area.innerHTML = vazioHTML('Não consegui ler as fichas.', fichas.error.message); return; }
  _fichas   = fichas.data || [];
  _catalogo = cat.error ? [] : (cat.data || []);

  renderEpiNumeros();
  renderEpiFiltros();
  filtrarEPI();
  renderCatalogo();
}

const trocaVencida  = (f) => f.troca_prevista && f.troca_prevista < hojeISO();
const trocaChegando = (f) => f.troca_prevista && !trocaVencida(f) &&
                             diasAte(f.troca_prevista) <= 15;

function renderEpiNumeros() {
  const semAss = _fichas.filter(f => !f.assinatura_ok).length;
  const vencidas = _fichas.filter(trocaVencida).length;
  const em30 = _fichas.filter(f => f.data_entrega >= diasAtras(30)).length;
  const pessoas = new Set(_fichas.map(f => f.contrato_id)).size;
  const tiles = [
    { rot:'Entregas · 30 d', val: em30, sub: plural(pessoas, 'pessoa atendida', 'pessoas atendidas') },
    { rot:'Sem assinatura', val: semAss,
      sub: semAss ? 'não provam fornecimento' : 'todas assinadas', urgente: semAss > 0 },
    { rot:'Troca vencida', val: vencidas,
      sub: vencidas ? 'substituir' : 'nenhuma vencida', urgente: vencidas > 0 },
    { rot:'No catálogo', val: _catalogo.filter(e => e.ativo).length, sub: 'tipos de EPI ativos' }
  ];
  const area = $('epi-numeros'); area.innerHTML='';
  tiles.forEach(t => {
    const d = document.createElement('div'); d.className='num';
    const r = document.createElement('p'); r.className='rotulo'; r.textContent=t.rot;
    const v = document.createElement('b'); v.textContent=t.val;
    const s = document.createElement('small'); s.textContent=t.sub;
    if (t.urgente) s.className='alerta';
    d.append(r,v,s); area.appendChild(d);
  });
}

function renderEpiFiltros() {
  const opcoes = [
    ['todas',    'Todas',           _fichas.length],
    ['semass',   'Sem assinatura',  _fichas.filter(f=>!f.assinatura_ok).length],
    ['vencidas', 'Troca vencida',   _fichas.filter(trocaVencida).length]
  ];
  const area = $('epi-filtros'); area.innerHTML='';
  opcoes.forEach(([v, rot, n]) => {
    const b = document.createElement('button');
    b.type='button'; b.className='filtro';
    b.setAttribute('aria-pressed', String(_epiFiltro === v));
    b.textContent = rot + ' (' + n + ')';
    b.addEventListener('click', () => { _epiFiltro = v; renderEpiFiltros(); filtrarEPI(); });
    area.appendChild(b);
  });
}

function filtrarEPI() {
  const termo = ($('busca-epi').value || '').trim().toLowerCase();
  let vistos = _fichas;
  if (_epiFiltro === 'semass')   vistos = vistos.filter(f => !f.assinatura_ok);
  if (_epiFiltro === 'vencidas') vistos = vistos.filter(trocaVencida);
  if (termo) vistos = vistos.filter(f =>
    [f.nome, f.epi, f.ca].filter(Boolean).join(' ').toLowerCase().includes(termo));

  const area = $('epi-lista');
  if (!_fichas.length) {
    area.innerHTML = vazioHTML('Nenhuma entrega registrada nesta obra.',
      'A ficha de EPI é o que prova que a empresa forneceu a proteção.');
    return;
  }
  if (!vistos.length) { area.innerHTML = vazioHTML('Nada neste filtro.'); return; }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  vistos.forEach(f => {
    const l = document.createElement('div'); l.className='pessoa';
    if (trocaVencida(f) || !f.assinatura_ok) l.dataset.nivel='grave';
    else if (trocaChegando(f)) l.dataset.nivel='atencao';

    const tarja = document.createElement('span'); tarja.className='tarja';
    const miolo = document.createElement('span'); miolo.className='miolo';
    const nm = document.createElement('span'); nm.className='nm'; nm.textContent = f.nome;
    const sub = document.createElement('span'); sub.className='sub';
    sub.textContent = [f.epi + (Number(f.quantidade) > 1 ? ' ×' + f.quantidade : ''),
                       f.ca ? 'CA ' + f.ca : null,
                       dataBR(f.data_entrega),
                       f.troca_prevista ? 'troca ' + dataBR(f.troca_prevista) : null]
                      .filter(Boolean).join(' · ');
    miolo.append(nm, sub);

    const lado = document.createElement('span'); lado.className='lado';
    const mv = document.createElement('span'); mv.className='chip'; mv.dataset.motivo=f.motivo;
    mv.textContent = MOTIVO_EPI[f.motivo] || f.motivo;
    lado.appendChild(mv);
    if (!f.assinatura_ok) {
      const a = document.createElement('span'); a.className='chip semass';
      a.textContent = 'sem assinatura'; lado.appendChild(a);
    }
    l.append(tarja, miolo, lado);
    cx.appendChild(l);
  });
}

$('busca-epi').addEventListener('input', filtrarEPI);

function renderCatalogo() {
  $('btn-catalogo').textContent = 'Catálogo de EPI (' + _catalogo.filter(e=>e.ativo).length + ')';
  const area = $('catalogo-lista');
  area.innerHTML = '<div class="pilha"></div>';
  const cx = area.firstElementChild;

  const novo = document.createElement('button');
  novo.type='button'; novo.className='btn btn-secundario';
  novo.textContent = '+ Novo tipo de EPI';
  novo.addEventListener('click', () => abrirEpiCatalogo(null));
  cx.appendChild(novo);

  _catalogo.forEach(e => {
    const b = document.createElement('button');
    b.type='button'; b.className='item' + (e.ativo ? '' : ' apagado');
    const corpo = document.createElement('span'); corpo.className='corpo';
    const t = document.createElement('b'); t.textContent = e.nome + (e.ativo ? '' : ' (inativo)');
    const s = document.createElement('small');
    s.textContent = [e.ca ? 'CA ' + e.ca : null,
                     e.validade_uso_dias ? 'troca a cada ' + e.validade_uso_dias + ' dias' : 'sem troca programada']
                    .filter(Boolean).join(' · ');
    corpo.append(t, s); b.appendChild(corpo);
    b.addEventListener('click', () => abrirEpiCatalogo(e));
    cx.appendChild(b);
  });
}

$('btn-catalogo').addEventListener('click', () => {
  const area = $('catalogo-lista');
  area.hidden = !area.hidden;
  $('btn-catalogo').setAttribute('aria-expanded', String(!area.hidden));
});

/* ---------- catálogo ---------- */
function abrirEpiCatalogo(e) {
  _epiCatEditando = e || null;
  $('titulo-epi-cat').textContent = e ? e.nome : 'Novo EPI';
  $('ec-nome').value = e ? e.nome : '';
  $('ec-ca').value = e && e.ca ? e.ca : '';
  $('ec-validade').value = e && e.validade_uso_dias ? e.validade_uso_dias : '';
  $('btn-desativar-epi').hidden = !e || !e.ativo;
  $('erro-epi-cat').hidden = true;
  $('folha-epi').hidden = false;
}
$('btn-fechar-epi').addEventListener('click', () => { $('folha-epi').hidden = true; });
$('folha-epi').addEventListener('click', (ev) => {
  if (ev.target === $('folha-epi')) $('folha-epi').hidden = true;
});

$('form-epi').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-epi-cat'); erro.hidden = true;
  const nome = $('ec-nome').value.trim();
  if (!nome) return falhar(erro, 'Diga o nome do EPI.');
  const dias = $('ec-validade').value === '' ? null : Number($('ec-validade').value);
  if (dias != null && dias < 1) return falhar(erro, 'Os dias de troca têm que ser maiores que zero.');

  const linha = { nome, ca: $('ec-ca').value.trim() || null, validade_uso_dias: dias };
  const { error } = _epiCatEditando
    ? await db.from('epis').update(linha).eq('id', _epiCatEditando.id)
    : await db.from('epis').insert({ ...linha, ativo: true });
  if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  $('folha-epi').hidden = true;
  await carregarEPI();
});

$('btn-desativar-epi').addEventListener('click', async () => {
  if (!_epiCatEditando) return;
  await db.from('epis').update({ ativo: false }).eq('id', _epiCatEditando.id);
  $('folha-epi').hidden = true;
  await carregarEPI();
});

/* ---------- entrega ---------- */
// Se a pessoa já recebeu esse EPI, o motivo padrão deixa de ser
// "primeira entrega" — e a tela mostra quando foi a última.
async function dicaDaEntrega() {
  const dica = $('dica-troca');
  const contrato = $('ep-contrato').value, epiId = $('ep-epi').value;
  dica.hidden = true;
  if (!contrato || !epiId) return;

  const epi = _catalogo.find(e => e.id === epiId);
  const anteriores = _fichas.filter(f => f.contrato_id === contrato && epi && f.epi === epi.nome);
  if (!anteriores.length) {
    if (epi && epi.validade_uso_dias)
      { dica.textContent = `Primeira entrega. Troca prevista em ${epi.validade_uso_dias} dias.`; dica.hidden = false; }
    return;
  }
  const ultima = anteriores[0];
  dica.textContent = `Já recebeu em ${dataBR(ultima.data_entrega)}` +
    (ultima.troca_prevista ? ` — troca prevista para ${dataBR(ultima.troca_prevista)}.` : '.');
  dica.hidden = false;
  if ($('ep-motivo').value === 'primeira_entrega') $('ep-motivo').value = 'troca';
}
$('ep-contrato').addEventListener('change', dicaDaEntrega);
$('ep-epi').addEventListener('change', dicaDaEntrega);

async function abrirEntrega() {
  if (!_efetivo.length) await carregarEfetivoSilencioso();
  _entregaEditando = null;

  const sc = $('ep-contrato');
  sc.innerHTML = '<option value="">— escolha —</option>';
  _efetivo.forEach(p => {
    const o = document.createElement('option');
    o.value = p.contrato_id; o.textContent = p.nome + ' · ' + p.funcao;
    sc.appendChild(o);
  });

  const se = $('ep-epi');
  se.innerHTML = '<option value="">— escolha —</option>';
  _catalogo.filter(e => e.ativo).forEach(e => {
    const o = document.createElement('option');
    o.value = e.id; o.textContent = e.nome + (e.ca ? ' · CA ' + e.ca : '');
    se.appendChild(o);
  });

  $('ep-data').value = hojeISO();
  $('ep-data').max = hojeISO();
  $('ep-qtd').value = 1;
  $('ep-motivo').value = 'primeira_entrega';
  $('ep-entregador').value = _perfilNome || '';
  $('ep-assinatura').checked = false;
  $('ep-obs').value = '';
  $('dica-troca').hidden = true;
  $('erro-entrega').hidden = true;
  $('btn-apagar-entrega').hidden = true;
  $('folha-entrega').hidden = false;
}

$('btn-nova-entrega').addEventListener('click', abrirEntrega);
$('btn-fechar-entrega').addEventListener('click', () => { $('folha-entrega').hidden = true; });
$('folha-entrega').addEventListener('click', (ev) => {
  if (ev.target === $('folha-entrega')) $('folha-entrega').hidden = true;
});

$('form-entrega').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-entrega'); erro.hidden = true;
  const contrato = $('ep-contrato').value, epiId = $('ep-epi').value;
  if (!contrato) return falhar(erro, 'Escolha para quem é a entrega.');
  if (!epiId)    return falhar(erro, 'Escolha o EPI. Se não estiver na lista, cadastre no catálogo.');
  const qtd = Number($('ep-qtd').value || 0);
  if (!(qtd > 0)) return falhar(erro, 'A quantidade tem que ser pelo menos 1.');

  const { error } = await db.from('epi_entregas').insert({
    contrato_id: contrato, epi_id: epiId,
    data_entrega: $('ep-data').value || hojeISO(),
    quantidade: qtd,
    motivo: $('ep-motivo').value,
    entregue_por: $('ep-entregador').value.trim() || null,
    assinatura_ok: $('ep-assinatura').checked,
    observacao: $('ep-obs').value.trim() || null
  });
  if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  $('folha-entrega').hidden = true;
  await carregarEPI();
});

/* ============================================================
   NOTAS FISCAIS
   O total da nota NÃO é somado aqui: um gatilho no banco recalcula
   a cada item. Se o app somasse, qualquer gravação por outro
   caminho deixaria o total mentindo.
   ============================================================ */

const CATEGORIAS_NF = ['Material','Serviço','Locação','Combustível','Alimentação',
                       'Transporte','Manutenção','EPI','Outros'];

let _nfs = [];
let _nf = null;
let _nfItens = [];
let _itemEditando = null;

const reais = (v) => Number(v || 0).toLocaleString('pt-BR',
  { style:'currency', currency:'BRL' });

async function carregarNFs() {
  $('nf-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('nf-lista');
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');
  const { data, error } = await db.from('nfs')
    .select('id, numero, serie, data, fornecedor, categoria, responsavel, total')
    .eq('obra_id', _obra.id).order('data', { ascending: false }).limit(400);

  if (error) { area.innerHTML = vazioHTML('Não consegui ler as notas.', error.message); return; }
  _nfs = data || [];
  renderNfNumeros();
  filtrarNFs();
}

function renderNfNumeros() {
  const soma = (l) => l.reduce((s, n) => s + Number(n.total || 0), 0);
  const em30 = _nfs.filter(n => n.data >= diasAtras(30));
  const semItem = _nfs.filter(n => Number(n.total || 0) === 0).length;
  const tiles = [
    { rot:'Notas · 30 d', val: em30.length, sub: reais(soma(em30)) },
    { rot:'No ano', val: _nfs.filter(n => n.data >= diasAtras(365)).length,
      sub: reais(soma(_nfs.filter(n => n.data >= diasAtras(365)))) },
    { rot:'Fornecedores', val: new Set(_nfs.map(n => n.fornecedor)).size, sub: 'diferentes' },
    { rot:'Sem itens', val: semItem,
      sub: semItem ? 'total zerado' : 'todas com item', urgente: semItem > 0 }
  ];
  const area = $('nf-numeros'); area.innerHTML='';
  tiles.forEach(t => {
    const d = document.createElement('div'); d.className='num';
    const r = document.createElement('p'); r.className='rotulo'; r.textContent=t.rot;
    const v = document.createElement('b'); v.textContent=t.val;
    const s = document.createElement('small'); s.className = t.urgente ? 'alerta' : 'dinheiro';
    s.textContent=t.sub;
    d.append(r,v,s); area.appendChild(d);
  });
}

function filtrarNFs() {
  const termo = ($('busca-nf').value || '').trim().toLowerCase();
  const vistos = termo
    ? _nfs.filter(n => [n.numero, n.serie, n.fornecedor, n.categoria]
        .filter(Boolean).join(' ').toLowerCase().includes(termo))
    : _nfs;

  const area = $('nf-lista');
  if (!_nfs.length) {
    area.innerHTML = vazioHTML('Nenhuma nota lançada nesta obra.',
      'Lance o cabeçalho e depois os itens — o total se soma sozinho.');
    return;
  }
  if (!vistos.length) { area.innerHTML = vazioHTML('Nada encontrado com "' + termo + '".'); return; }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  vistos.forEach(n => {
    const b = document.createElement('button');
    b.type='button'; b.className='pessoa';
    if (Number(n.total || 0) === 0) b.dataset.nivel = 'atencao';
    const tarja = document.createElement('span'); tarja.className='tarja';
    const pref = document.createElement('span'); pref.className='pref';
    pref.textContent = 'nº ' + n.numero + (n.serie ? '/' + n.serie : '');
    const miolo = document.createElement('span'); miolo.className='miolo';
    const nm = document.createElement('span'); nm.className='nm'; nm.textContent = n.fornecedor;
    const sub = document.createElement('span'); sub.className='sub';
    sub.textContent = [dataBR(n.data), n.categoria, n.responsavel].filter(Boolean).join(' · ');
    miolo.append(nm, sub);
    const lado = document.createElement('span'); lado.className='lado';
    const val = document.createElement('span'); val.className='chip disp';
    val.textContent = reais(n.total);
    lado.appendChild(val);
    b.append(tarja, pref, miolo, lado);
    b.addEventListener('click', () => abrirNF(n.id));
    cx.appendChild(b);
  });
}
$('busca-nf').addEventListener('input', filtrarNFs);

/* ---------- criar ---------- */
$('btn-nova-nf').addEventListener('click', () => {
  $('nn-numero').value = ''; $('nn-serie').value = '';
  $('nn-fornecedor').value = ''; $('nn-data').value = hojeISO();
  $('nn-data').max = hojeISO();
  $('erro-nova-nf').hidden = true;
  $('folha-nova-nf').hidden = false;
  $('nn-numero').focus();
});
$('btn-fechar-nova-nf').addEventListener('click', () => { $('folha-nova-nf').hidden = true; });
$('folha-nova-nf').addEventListener('click', (ev) => {
  if (ev.target === $('folha-nova-nf')) $('folha-nova-nf').hidden = true;
});

$('form-nova-nf').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-nova-nf'); erro.hidden = true;
  const numero = $('nn-numero').value.trim();
  const fornecedor = $('nn-fornecedor').value.trim();
  const data = $('nn-data').value;
  if (!numero)     return falhar(erro, 'Informe o número da nota.');
  if (!fornecedor) return falhar(erro, 'Informe o fornecedor.');
  if (!data)       return falhar(erro, 'Informe a data da nota.');

  const { data: nova, error } = await db.from('nfs').insert({
    obra_id: _obra.id, numero, serie: $('nn-serie').value.trim() || null,
    fornecedor, data
  }).select('id').single();

  if (error) {
    // uq_nf é NULLS NOT DISTINCT: duas notas sem série, mesmo número e
    // mesmo fornecedor, também batem de frente.
    return falhar(erro, /uq_nf\b/.test(error.message)
      ? `Já existe a nota ${numero}${$('nn-serie').value.trim() ? '/'+$('nn-serie').value.trim() : ' (sem série)'} desse fornecedor.`
      : 'Não consegui criar: ' + error.message);
  }
  $('folha-nova-nf').hidden = true;
  await carregarNFs();
  await abrirNF(nova.id);
});

/* ---------- nota aberta ---------- */
async function abrirNF(id) {
  irPara('nf-edit');
  const { data, error } = await db.from('nfs').select('*').eq('id', id).single();
  if (error || !data) { falhar($('erro-nf-edit'), 'Não consegui abrir a nota.'); return; }
  _nf = data;

  $('nf-e-obra').textContent = _obra.codigo + ' · ' + _obra.nome;
  $('nf-e-numero').textContent = 'nº ' + data.numero + (data.serie ? '/' + data.serie : '');
  $('nf-e-fornecedor').textContent = data.fornecedor;
  $('nf-e-data').textContent = dataBR(data.data);

  const sel = $('nf-categoria');
  sel.innerHTML = '<option value="">— sem categoria —</option>';
  const lista = CATEGORIAS_NF.slice();
  if (data.categoria && !lista.includes(data.categoria)) lista.push(data.categoria);
  lista.forEach(cat => {
    const o = document.createElement('option'); o.value=cat; o.textContent=cat;
    if (cat === data.categoria) o.selected = true;
    sel.appendChild(o);
  });

  document.querySelectorAll('#tela-nf-edit [data-nf]').forEach(el => {
    const c = el.dataset.nf;
    if (c !== 'categoria') el.value = data[c] == null ? '' : data[c];
  });

  await carregarItens();
}

// Mesma regra do RDO: grava campo a campo, sem botão de salvar.
function ligarCamposDaNF() {
  document.querySelectorAll('#tela-nf-edit [data-nf]').forEach(el => {
    const evento = el.tagName === 'SELECT' ? 'change' : 'blur';
    el.addEventListener(evento, async () => {
      if (!_nf) return;
      const campo = el.dataset.nf;
      let valor = el.value === '' ? null : el.value;
      if (['numero','fornecedor','data'].includes(campo) && !valor) {
        el.value = _nf[campo] || '';
        return falhar($('erro-nf-edit'), 'Número, fornecedor e data não podem ficar em branco.');
      }
      if ((_nf[campo] == null ? '' : String(_nf[campo])) === (valor == null ? '' : valor)) return;

      const { error } = await db.from('nfs').update({ [campo]: valor }).eq('id', _nf.id);
      if (error) {
        el.value = _nf[campo] == null ? '' : _nf[campo];
        return falhar($('erro-nf-edit'), /uq_nf\b/.test(error.message)
          ? 'Já existe outra nota com esse número, série e fornecedor.'
          : 'Não consegui gravar: ' + error.message);
      }
      _nf[campo] = valor;
      $('erro-nf-edit').hidden = true;
      if (campo === 'numero' || campo === 'serie')
        $('nf-e-numero').textContent = 'nº ' + _nf.numero + (_nf.serie ? '/' + _nf.serie : '');
      if (campo === 'fornecedor') $('nf-e-fornecedor').textContent = _nf.fornecedor;
      if (campo === 'data') $('nf-e-data').textContent = dataBR(_nf.data);
      avisarGravadoNF();
    });
  });
}

let _relogioNF = null;
function avisarGravadoNF() {
  const s = $('nf-gravou'); s.hidden = false;
  clearTimeout(_relogioNF);
  _relogioNF = setTimeout(() => { s.hidden = true; }, 1800);
}

async function carregarItens() {
  const { data } = await db.from('nf_itens')
    .select('id, seq, descricao, unidade, quantidade, preco_unitario, total_item')
    .eq('nf_id', _nf.id).order('seq');
  _nfItens = data || [];

  const area = $('nf-itens');
  if (!_nfItens.length) {
    area.innerHTML = vazioHTML('Nota sem itens.', 'O total só existe depois que os itens entram.');
  } else {
    area.innerHTML = '<div class="pilha"></div>';
    const cx = area.firstElementChild;
    _nfItens.forEach(i => {
      const b = document.createElement('button');
      b.type='button'; b.className='item';
      const corpo = document.createElement('span'); corpo.className='corpo';
      const t = document.createElement('b'); t.textContent = i.seq + '. ' + i.descricao;
      const s = document.createElement('small');
      s.textContent = Number(i.quantidade).toLocaleString('pt-BR') +
        (i.unidade ? ' ' + i.unidade : '') + ' × ' + reais(i.preco_unitario);
      corpo.append(t, s);
      const m = document.createElement('span'); m.className='medida';
      m.textContent = reais(i.total_item);
      b.append(corpo, m);
      b.addEventListener('click', () => abrirItem(i));
      cx.appendChild(b);
    });
  }

  // O total vem do banco, recalculado pelo gatilho. Não somo aqui:
  // dois lugares somando é um lugar para discordar.
  const { data: nf } = await db.from('nfs').select('total').eq('id', _nf.id).single();
  $('nf-total').textContent = reais(nf ? nf.total : 0);
  if (nf) _nf.total = nf.total;
}

function abrirItem(i) {
  _itemEditando = i || null;
  $('titulo-item').textContent = i ? 'Item ' + i.seq : 'Novo item';
  $('it-descricao').value = i ? i.descricao : '';
  $('it-qtd').value       = i ? i.quantidade : '';
  $('it-unidade').value   = i && i.unidade ? i.unidade : '';
  $('it-preco').value     = i ? i.preco_unitario : '';
  $('btn-apagar-item').hidden = !i;
  $('erro-item').hidden = true;
  calcularItem();
  $('folha-item').hidden = false;
}

function calcularItem() {
  const q = Number($('it-qtd').value || 0), p = Number($('it-preco').value || 0);
  $('dica-item').textContent = (q > 0 && p >= 0)
    ? 'Total do item: ' + reais(Math.round(q * p * 100) / 100)
    : '';
}
['it-qtd','it-preco'].forEach(id => $(id).addEventListener('input', calcularItem));

$('btn-add-item').addEventListener('click', () => abrirItem(null));
$('btn-fechar-item').addEventListener('click', () => { $('folha-item').hidden = true; });
$('folha-item').addEventListener('click', (ev) => {
  if (ev.target === $('folha-item')) $('folha-item').hidden = true;
});

$('form-item').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-item'); erro.hidden = true;
  const descricao = $('it-descricao').value.trim();
  const q = Number($('it-qtd').value), p = Number($('it-preco').value);
  if (!descricao) return falhar(erro, 'Descreva o item.');
  if (!(q > 0))   return falhar(erro, 'A quantidade tem que ser maior que zero.');
  if (!(p >= 0))  return falhar(erro, 'O preço não pode ser negativo.');

  // total_item é calculado pelo banco — nunca mando.
  const linha = { descricao, unidade: $('it-unidade').value.trim() || null,
                  quantidade: q, preco_unitario: p };
  const { error } = _itemEditando
    ? await db.from('nf_itens').update(linha).eq('id', _itemEditando.id)
    : await db.from('nf_itens').insert({ ...linha, nf_id: _nf.id,
        seq: _nfItens.reduce((m, i) => Math.max(m, i.seq), 0) + 1 });

  if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  $('folha-item').hidden = true;
  await carregarItens();
  await carregarNFs();
  avisarGravadoNF();
});

$('btn-apagar-item').addEventListener('click', async () => {
  if (!_itemEditando) return;
  await db.from('nf_itens').delete().eq('id', _itemEditando.id);
  $('folha-item').hidden = true;
  await carregarItens();
  await carregarNFs();
});

ligarCamposDaNF();

/* ============================================================
   MEDIÇÕES
   Três níveis: contrato comercial → itens → boletim mensal.
   O acumulado de cada item não é somado aqui: a vw_medicao_item
   já traz anterior, atual, acumulado e saldo, com janela sobre o
   número da medição. Refazer essa conta no app seria dois lugares
   para discordar.
   ============================================================ */

let _contratos = [];
let _contrato  = null;
let _ctItens   = [];
let _medicoes  = [];
let _medicao   = null;
let _mdItens   = [];
let _ccEditando = null;
let _ciEditando = null;

async function carregarMedicoes() {
  $('md-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('md-lista');
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');
  const [cts, saldos] = await Promise.all([
    db.from('contratos_comerciais')
      .select('id, tipo, nome, empresa, especialidade, numero_contrato, ativo')
      .eq('obra_id', _obra.id).order('nome'),
    db.from('vw_contrato_saldo')
      .select('contrato_id, valor_contratado, valor_medido, valor_saldo, medicoes_lancadas')
      .eq('obra', _obra.codigo)
  ]);

  if (cts.error) { area.innerHTML = vazioHTML('Não consegui ler os contratos.', cts.error.message); return; }
  _contratos = cts.data || [];
  const saldo = {};
  (saldos.error ? [] : (saldos.data || [])).forEach(s => { saldo[s.contrato_id] = s; });

  const somaOnde = (tipo, campo) => _contratos.filter(c => c.tipo === tipo)
    .reduce((s, c) => s + Number((saldo[c.id] || {})[campo] || 0), 0);

  const tiles = [
    { rot:'Contratos', val: _contratos.filter(c=>c.ativo).length, sub:'ativos nesta obra' },
    { rot:'A receber', val: reais(somaOnde('cliente','valor_saldo')),
      sub: 'de ' + reais(somaOnde('cliente','valor_contratado')) },
    { rot:'A pagar', val: reais(somaOnde('empreiteiro','valor_saldo')),
      sub: 'de ' + reais(somaOnde('empreiteiro','valor_contratado')) },
    { rot:'Medições', val: Object.values(saldo).reduce((s,x)=>s+Number(x.medicoes_lancadas||0),0),
      sub:'lançadas no total' }
  ];
  const nums = $('md-numeros'); nums.innerHTML='';
  tiles.forEach(t => {
    const d = document.createElement('div'); d.className='num';
    const r = document.createElement('p'); r.className='rotulo'; r.textContent=t.rot;
    const v = document.createElement('b'); v.textContent=t.val;
    if (String(t.val).startsWith('R$')) v.style.fontSize = '19px';
    const s = document.createElement('small'); s.className='dinheiro'; s.textContent=t.sub;
    d.append(r,v,s); nums.appendChild(d);
  });

  if (!_contratos.length) {
    area.innerHTML = vazioHTML('Nenhum contrato nesta obra.',
      'A medição mede um contrato: primeiro o contrato e seus itens, depois o boletim do mês.');
    return;
  }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  _contratos.forEach(c => {
    const s = saldo[c.id] || {};
    const b = document.createElement('button');
    b.type='button'; b.className='pessoa' + (c.ativo ? '' : ' encerrada');
    const tarja = document.createElement('span'); tarja.className='tarja';
    const miolo = document.createElement('span'); miolo.className='miolo';
    const nm = document.createElement('span'); nm.className='nm'; nm.textContent = c.nome;
    const sub = document.createElement('span'); sub.className='sub';
    sub.textContent = [c.empresa, c.numero_contrato,
      plural(Number(s.medicoes_lancadas||0), 'medição', 'medições')].filter(Boolean).join(' · ');
    const desc = document.createElement('span'); desc.className='desc';
    desc.textContent = 'Contratado ' + reais(s.valor_contratado) +
                       ' · medido ' + reais(s.valor_medido) +
                       ' · saldo ' + reais(s.valor_saldo);
    miolo.append(nm, sub, desc);
    const lado = document.createElement('span'); lado.className='lado';
    const tp = document.createElement('span'); tp.className='chip'; tp.dataset.tipo=c.tipo;
    tp.textContent = c.tipo === 'cliente' ? 'Cliente' : 'Empreiteiro';
    lado.appendChild(tp);
    b.append(tarja, miolo, lado);
    b.addEventListener('click', () => abrirContrato(c.id));
    cx.appendChild(b);
  });
}

/* ---------- contrato ---------- */
function abrirFolhaContrato(c) {
  _ccEditando = c || null;
  $('titulo-contrato').textContent = c ? c.nome : 'Novo contrato';
  $('cc-tipo').value = c ? c.tipo : 'cliente';
  $('cc-nome').value = c ? c.nome : '';
  $('cc-empresa').value = c && c.empresa ? c.empresa : '';
  $('cc-especialidade').value = c && c.especialidade ? c.especialidade : '';
  $('cc-numero').value = c && c.numero_contrato ? c.numero_contrato : '';
  $('btn-encerrar-contrato').hidden = !c || !c.ativo;
  $('erro-contrato-folha').hidden = true;
  $('folha-contrato').hidden = false;
}
$('btn-novo-contrato').addEventListener('click', () => abrirFolhaContrato(null));
$('btn-fechar-contrato').addEventListener('click', () => { $('folha-contrato').hidden = true; });
$('folha-contrato').addEventListener('click', (ev) => {
  if (ev.target === $('folha-contrato')) $('folha-contrato').hidden = true;
});

$('form-contrato').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-contrato-folha'); erro.hidden = true;
  const nome = $('cc-nome').value.trim();
  if (!nome) return falhar(erro, 'O contrato precisa de um nome.');
  const linha = {
    tipo: $('cc-tipo').value, nome,
    empresa: $('cc-empresa').value.trim(),
    especialidade: $('cc-especialidade').value.trim(),
    numero_contrato: $('cc-numero').value.trim()
  };
  const { error } = _ccEditando
    ? await db.from('contratos_comerciais').update(linha).eq('id', _ccEditando.id)
    : await db.from('contratos_comerciais').insert({ ...linha, obra_id: _obra.id, ativo: true });
  if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  $('folha-contrato').hidden = true;
  await carregarMedicoes();
  if (_contrato && _ccEditando) await abrirContrato(_ccEditando.id);
});

$('btn-encerrar-contrato').addEventListener('click', async () => {
  if (!_ccEditando) return;
  await db.from('contratos_comerciais').update({ ativo: false }).eq('id', _ccEditando.id);
  $('folha-contrato').hidden = true;
  await carregarMedicoes();
});

async function abrirContrato(id) {
  irPara('contrato');
  const [ct, itens, meds, saldo] = await Promise.all([
    db.from('contratos_comerciais').select('*').eq('id', id).single(),
    db.from('contrato_itens')
      .select('id, item, descricao, unidade, quantidade, valor_unitario, valor_total')
      .eq('contrato_id', id).order('item'),
    db.from('medicoes')
      .select('id, numero, mes_referencia, data_inicio, data_fim, fechada')
      .eq('contrato_id', id).order('numero', { ascending: false }),
    db.from('vw_contrato_saldo').select('*').eq('contrato_id', id).maybeSingle()
  ]);

  if (ct.error) { falhar($('erro-contrato'), 'Não consegui abrir o contrato.'); return; }
  _contrato = ct.data; _ctItens = itens.data || []; _medicoes = meds.data || [];

  $('ct-e-obra').textContent = _obra.codigo + ' · ' + _obra.nome;
  $('ct-e-nome').textContent = _contrato.nome;
  $('ct-e-empresa').textContent =
    [(_contrato.tipo === 'cliente' ? 'Cliente' : 'Empreiteiro'),
     _contrato.empresa, _contrato.numero_contrato].filter(Boolean).join(' · ');

  const s = saldo.data || {};
  const tiles = [
    { rot:'Contratado', val: reais(s.valor_contratado), sub: plural(_ctItens.length,'item','itens') },
    { rot:'Medido',     val: reais(s.valor_medido),     sub: plural(_medicoes.length,'medição','medições') },
    { rot:'Saldo',      val: reais(s.valor_saldo),      sub: 'a medir' },
    { rot:'Avanço',     val: Number(s.valor_contratado) > 0
        ? Math.round(100 * Number(s.valor_medido) / Number(s.valor_contratado)) + '%' : '—',
      sub: 'do valor contratado' }
  ];
  const nums = $('ct-numeros'); nums.innerHTML='';
  tiles.forEach(t => {
    const d = document.createElement('div'); d.className='num';
    const r = document.createElement('p'); r.className='rotulo'; r.textContent=t.rot;
    const v = document.createElement('b'); v.textContent=t.val;
    if (String(t.val).startsWith('R$')) v.style.fontSize = '19px';
    const sm = document.createElement('small'); sm.textContent=t.sub;
    d.append(r,v,sm); nums.appendChild(d);
  });

  renderCtItens();
  renderCtMedicoes();
}

function renderCtItens() {
  const area = $('ct-itens');
  if (!_ctItens.length) {
    area.innerHTML = vazioHTML('Contrato sem itens.',
      'Sem item não há o que medir: a planilha de medição sai daqui.');
    return;
  }
  area.innerHTML = '<div class="pilha"></div>';
  const cx = area.firstElementChild;
  _ctItens.forEach(i => {
    const b = document.createElement('button');
    b.type='button'; b.className='item';
    const corpo = document.createElement('span'); corpo.className='corpo';
    const t = document.createElement('b');
    t.textContent = (i.item ? i.item + ' — ' : '') + i.descricao;
    const s = document.createElement('small');
    s.textContent = Number(i.quantidade).toLocaleString('pt-BR') +
      (i.unidade ? ' ' + i.unidade : '') + ' × ' + reais(i.valor_unitario);
    corpo.append(t, s);
    const m = document.createElement('span'); m.className='medida';
    m.textContent = reais(i.valor_total);
    b.append(corpo, m);
    b.addEventListener('click', () => abrirCtItem(i));
    cx.appendChild(b);
  });
}

function renderCtMedicoes() {
  const area = $('ct-medicoes');
  if (!_medicoes.length) {
    area.innerHTML = vazioHTML('Nenhuma medição lançada neste contrato.');
    return;
  }
  area.innerHTML = '<div class="pilha"></div>';
  const cx = area.firstElementChild;
  _medicoes.forEach(m => {
    const b = document.createElement('button');
    b.type='button'; b.className='item';
    const corpo = document.createElement('span'); corpo.className='corpo';
    const t = document.createElement('b'); t.textContent = 'Medição nº ' + m.numero + ' · ' + m.mes_referencia;
    const s = document.createElement('small');
    s.textContent = dataBR(m.data_inicio) + ' a ' + dataBR(m.data_fim);
    corpo.append(t, s);
    const c = document.createElement('span');
    c.className = 'chip ' + (m.fechada ? 'fechada' : 'aberta');
    c.textContent = m.fechada ? 'Fechada' : 'Aberta';
    b.append(corpo, c);
    b.addEventListener('click', () => abrirMedicao(m.id));
    cx.appendChild(b);
  });
}

function abrirCtItem(i) {
  _ciEditando = i || null;
  $('titulo-ct-item').textContent = i ? 'Item do contrato' : 'Novo item';
  $('ci-descricao').value = i ? i.descricao : '';
  $('ci-item').value      = i && i.item ? i.item : '';
  $('ci-qtd').value       = i ? i.quantidade : '';
  $('ci-unidade').value   = i && i.unidade ? i.unidade : '';
  $('ci-valor').value     = i ? i.valor_unitario : '';
  $('btn-apagar-ct-item').hidden = !i;
  $('erro-ct-item').hidden = true;
  calcularCtItem();
  $('folha-ct-item').hidden = false;
}
function calcularCtItem() {
  const q = Number($('ci-qtd').value || 0), v = Number($('ci-valor').value || 0);
  $('dica-ct-item').textContent = (q > 0 && v >= 0)
    ? 'Valor do item: ' + reais(Math.round(q * v * 100) / 100) : '';
}
['ci-qtd','ci-valor'].forEach(id => $(id).addEventListener('input', calcularCtItem));

$('btn-add-ct-item').addEventListener('click', () => abrirCtItem(null));
$('btn-fechar-ct-item').addEventListener('click', () => { $('folha-ct-item').hidden = true; });
$('folha-ct-item').addEventListener('click', (ev) => {
  if (ev.target === $('folha-ct-item')) $('folha-ct-item').hidden = true;
});

$('form-ct-item').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-ct-item'); erro.hidden = true;
  const descricao = $('ci-descricao').value.trim();
  const q = Number($('ci-qtd').value), v = Number($('ci-valor').value);
  if (!descricao)  return falhar(erro, 'Descreva o item.');
  if (!(q >= 0))   return falhar(erro, 'A quantidade não pode ser negativa.');
  if (!(v >= 0))   return falhar(erro, 'O valor unitário não pode ser negativo.');

  // valor_total é calculado pelo banco.
  const linha = { item: $('ci-item').value.trim(), descricao,
                  unidade: $('ci-unidade').value.trim(), quantidade: q, valor_unitario: v };
  const { error } = _ciEditando
    ? await db.from('contrato_itens').update(linha).eq('id', _ciEditando.id)
    : await db.from('contrato_itens').insert({ ...linha, contrato_id: _contrato.id });
  if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  $('folha-ct-item').hidden = true;
  await abrirContrato(_contrato.id);
});

$('btn-apagar-ct-item').addEventListener('click', async () => {
  if (!_ciEditando) return;
  const { error } = await db.from('contrato_itens').delete().eq('id', _ciEditando.id);
  if (error) return falhar($('erro-ct-item'),
    'Não consegui apagar. Se o item já foi medido, o banco impede — e está certo: ' +
    'apagar levaria a medição junto.');
  $('folha-ct-item').hidden = true;
  await abrirContrato(_contrato.id);
});

/* ---------- boletim de medição ---------- */
$('btn-add-medicao').addEventListener('click', () => {
  const hoje = new Date(hojeISO() + 'T00:00:00');
  const mes = hojeISO().slice(0, 7);
  const primeiro = mes + '-01';
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  $('nm-mes').value = mes;
  $('nm-inicio').value = primeiro;
  $('nm-fim').value = ultimo;
  $('erro-nova-medicao').hidden = true;
  $('folha-nova-medicao').hidden = false;
});
$('btn-fechar-nova-medicao').addEventListener('click', () => { $('folha-nova-medicao').hidden = true; });
$('folha-nova-medicao').addEventListener('click', (ev) => {
  if (ev.target === $('folha-nova-medicao')) $('folha-nova-medicao').hidden = true;
});
// Mudar o mês reposiciona o período: quase sempre é o mês cheio.
$('nm-mes').addEventListener('change', () => {
  const m = $('nm-mes').value;
  if (!m) return;
  const [a, mm] = m.split('-').map(Number);
  $('nm-inicio').value = m + '-01';
  $('nm-fim').value = new Date(a, mm, 0).toISOString().slice(0, 10);
});

$('form-nova-medicao').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-nova-medicao'); erro.hidden = true;
  const mes = $('nm-mes').value, ini = $('nm-inicio').value, fim = $('nm-fim').value;
  if (!mes)  return falhar(erro, 'Informe o mês de referência.');
  if (!ini || !fim) return falhar(erro, 'Informe o início e o fim do período.');
  if (fim < ini)    return falhar(erro, 'O fim do período não pode ser antes do início.');

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { data: ultimo } = await db.from('medicoes').select('numero')
      .eq('contrato_id', _contrato.id).order('numero', { ascending: false }).limit(1).maybeSingle();
    const numero = (ultimo ? ultimo.numero : 0) + 1;

    const { data: nova, error } = await db.from('medicoes').insert({
      contrato_id: _contrato.id, numero, mes_referencia: mes,
      data_inicio: ini, data_fim: fim
    }).select('id').single();

    if (!error) {
      $('folha-nova-medicao').hidden = true;
      await abrirMedicao(nova.id);
      return;
    }
    if (/medicoes_contrato_id_numero_key|unique/i.test(error.message)) continue;
    return falhar(erro, 'Não consegui criar: ' + error.message);
  }
  falhar(erro, 'Duas medições foram criadas ao mesmo tempo. Tente de novo.');
});

async function abrirMedicao(id) {
  irPara('medicao');
  const { data: m, error } = await db.from('medicoes').select('*').eq('id', id).single();
  if (error || !m) return;
  _medicao = m;

  $('md-e-contrato').textContent = _contrato ? _contrato.nome : '';
  $('md-e-numero').textContent = 'nº ' + m.numero;
  $('md-e-mes').textContent = m.mes_referencia;
  $('md-e-periodo').textContent = dataBR(m.data_inicio) + ' a ' + dataBR(m.data_fim);
  $('btn-fechar-medicao').textContent = m.fechada ? 'Reabrir medição' : 'Fechar medição';

  const av = $('aviso-medicao');
  av.hidden = !m.fechada;
  if (m.fechada) av.textContent =
    'Medição fechada. Os campos ficam travados — reabra para corrigir.';

  await carregarItensMedicao();
}

async function carregarItensMedicao() {
  // A view faz a conta acumulada com janela sobre o número da medição.
  // Peço o contrato inteiro e fico com as linhas desta medição.
  const { data, error } = await db.from('vw_medicao_item')
    .select('medicao_id, item_id, item, descricao, unidade, qtd_contratada, valor_unitario, ' +
            'qtd_anterior, qtd_atual, qtd_acumulada, qtd_saldo, valor_atual, valor_acumulado')
    .eq('contrato_id', _contrato.id);

  const area = $('md-e-itens');
  if (error) { area.innerHTML = vazioHTML('Não consegui ler a medição.', error.message); return; }

  _mdItens = (data || []).filter(i => i.medicao_id === _medicao.id)
    .sort((a, b) => String(a.item).localeCompare(String(b.item), 'pt-BR', { numeric: true }));

  const totalAtual = _mdItens.reduce((s, i) => s + Number(i.valor_atual || 0), 0);
  const totalAcum  = _mdItens.reduce((s, i) => s + Number(i.valor_acumulado || 0), 0);
  const estourados = _mdItens.filter(i => Number(i.qtd_saldo) < 0).length;

  const tiles = [
    { rot:'Nesta medição', val: reais(totalAtual), sub: plural(_mdItens.length,'item','itens') },
    { rot:'Acumulado', val: reais(totalAcum), sub:'desde a primeira' },
    { rot:'Itens medidos', val: _mdItens.filter(i => Number(i.qtd_atual) > 0).length,
      sub:'com quantidade neste mês' },
    { rot:'Acima do contrato', val: estourados,
      sub: estourados ? 'saldo negativo' : 'nenhum estourado', urgente: estourados > 0 }
  ];
  const nums = $('md-e-numeros'); nums.innerHTML='';
  tiles.forEach(t => {
    const d = document.createElement('div'); d.className='num';
    const r = document.createElement('p'); r.className='rotulo'; r.textContent=t.rot;
    const v = document.createElement('b'); v.textContent=t.val;
    if (String(t.val).startsWith('R$')) v.style.fontSize = '19px';
    const s = document.createElement('small'); s.textContent=t.sub;
    if (t.urgente) s.className='alerta';
    d.append(r,v,s); nums.appendChild(d);
  });

  if (!_mdItens.length) {
    area.innerHTML = vazioHTML('O contrato não tem itens.',
      'Volte ao contrato e lance os itens: a medição mede o que está contratado.');
    return;
  }

  area.innerHTML = '<div class="chamada"></div>';
  const cx = area.firstElementChild;
  _mdItens.forEach(i => cx.appendChild(linhaMedicao(i)));
}

function linhaMedicao(i) {
  const l = document.createElement('div');
  l.className = 'medida-linha';
  l.dataset.estouro = Number(i.qtd_saldo) < 0 ? 'sim' : 'nao';

  const oque = document.createElement('div'); oque.className = 'oque';
  oque.textContent = (i.item ? i.item + ' — ' : '') + i.descricao;
  const s = document.createElement('small');
  s.textContent = 'Contratado ' + Number(i.qtd_contratada).toLocaleString('pt-BR') +
    (i.unidade ? ' ' + i.unidade : '') + ' × ' + reais(i.valor_unitario) +
    ' · anterior ' + Number(i.qtd_anterior).toLocaleString('pt-BR');
  oque.appendChild(s);

  const conta = document.createElement('div'); conta.className = 'conta';
  const rot = document.createElement('label');
  rot.textContent = 'Neste mês';
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = '0'; inp.step = '0.001'; inp.inputMode = 'decimal';
  inp.value = Number(i.qtd_atual);
  inp.disabled = _medicao.fechada;
  inp.setAttribute('aria-label', 'Quantidade medida de ' + i.descricao);
  rot.appendChild(inp);

  const acum = document.createElement('span');
  const pintarAcum = () => {
    acum.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = reais(i.valor_atual);
    acum.append('Acum. ' + Number(i.qtd_acumulada).toLocaleString('pt-BR') +
                ' · saldo ' + Number(i.qtd_saldo).toLocaleString('pt-BR') + ' · ');
    acum.appendChild(b);
  };
  pintarAcum();

  inp.addEventListener('change', async () => {
    let q = Number(inp.value || 0);
    if (!(q >= 0)) { q = 0; inp.value = 0; }
    await gravarMedicaoItem(i, q);
  });

  conta.append(rot, acum);
  l.append(oque, conta);
  return l;
}

async function gravarMedicaoItem(i, quantidade) {
  // uq (medicao_id, item_id): existe uma linha por item por medição.
  const { data: ja } = await db.from('medicao_itens').select('id')
    .eq('medicao_id', _medicao.id).eq('item_id', i.item_id).maybeSingle();

  const r = ja
    ? await db.from('medicao_itens').update({ quantidade }).eq('id', ja.id)
    : await db.from('medicao_itens').insert({ medicao_id: _medicao.id, item_id: i.item_id, quantidade });

  if (r.error) { falhar($('erro-contrato'), 'Não consegui gravar: ' + r.error.message); return; }
  const s = $('md-gravou'); s.hidden = false;
  setTimeout(() => { s.hidden = true; }, 1800);
  await carregarItensMedicao();
}

$('btn-fechar-medicao').addEventListener('click', async () => {
  if (!_medicao) return;
  await db.from('medicoes').update({ fechada: !_medicao.fechada }).eq('id', _medicao.id);
  await abrirMedicao(_medicao.id);
});

/* ============================================================
   REUNIÕES — pauta, ata e o que virou tarefa
   ============================================================ */

let _reunioes = [];
let _reuniao = null;
let _participantes = [];
let _topicos = [];
let _ptEditando = null;
let _tpEditando = null;

async function carregarReunioes() {
  $('rn-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('rn-lista');
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');
  const { data, error } = await db.from('reunioes')
    .select('id, titulo, data, hora_inicio, hora_fim, local, proxima_data')
    .eq('obra_id', _obra.id).order('data', { ascending: false }).limit(200);
  if (error) { area.innerHTML = vazioHTML('Não consegui ler as reuniões.', error.message); return; }
  _reunioes = data || [];

  const em30 = _reunioes.filter(r => r.data >= diasAtras(30)).length;
  const proxima = _reunioes.map(r => r.proxima_data).filter(d => d && d >= hojeISO()).sort()[0];
  const tiles = [
    { rot:'Últimos 30 dias', val: em30, sub: em30 ? 'realizadas' : 'nenhuma' },
    { rot:'No total', val: _reunioes.length, sub:'nesta obra' },
    { rot:'Próxima', val: proxima ? dataBR(proxima) : '—',
      sub: proxima ? 'já marcada' : 'nada marcado' },
    { rot:'Tarefas de reunião', val: '—', sub:'ver em Tarefas' }
  ];
  const nums = $('rn-numeros'); nums.innerHTML='';
  tiles.forEach(t => {
    const d = document.createElement('div'); d.className='num';
    const r = document.createElement('p'); r.className='rotulo'; r.textContent=t.rot;
    const v = document.createElement('b'); v.textContent=t.val;
    if (String(t.val).includes('/')) v.style.fontSize = '19px';
    const s = document.createElement('small'); s.textContent=t.sub;
    d.append(r,v,s); nums.appendChild(d);
  });

  if (!_reunioes.length) {
    area.innerHTML = vazioHTML('Nenhuma reunião registrada.',
      'A ata guarda o que ficou combinado — e o tópico pode virar tarefa com responsável.');
    return;
  }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  _reunioes.forEach(r => {
    const b = document.createElement('button');
    b.type='button'; b.className='pessoa';
    const tarja = document.createElement('span'); tarja.className='tarja';
    const miolo = document.createElement('span'); miolo.className='miolo';
    const nm = document.createElement('span'); nm.className='nm'; nm.textContent = r.titulo;
    const sub = document.createElement('span'); sub.className='sub';
    sub.textContent = [dataBR(r.data), r.local,
      r.hora_inicio ? r.hora_inicio.slice(0,5) + (r.hora_fim ? ' às ' + r.hora_fim.slice(0,5) : '') : null]
      .filter(Boolean).join(' · ');
    miolo.append(nm, sub);
    b.append(tarja, miolo);
    b.addEventListener('click', () => abrirAta(r.id));
    cx.appendChild(b);
  });
}

$('btn-nova-reuniao').addEventListener('click', () => {
  $('nr-titulo').value = 'Reunião de obra';
  $('nr-data').value = hojeISO();
  $('nr-local').value = 'Canteiro';
  $('erro-reuniao').hidden = true;
  $('folha-reuniao').hidden = false;
});
$('btn-fechar-reuniao').addEventListener('click', () => { $('folha-reuniao').hidden = true; });
$('folha-reuniao').addEventListener('click', (ev) => {
  if (ev.target === $('folha-reuniao')) $('folha-reuniao').hidden = true;
});

$('form-reuniao').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-reuniao'); erro.hidden = true;
  const titulo = $('nr-titulo').value.trim();
  const data = $('nr-data').value;
  if (!titulo) return falhar(erro, 'A reunião precisa de um título.');
  if (!data)   return falhar(erro, 'Informe a data.');
  const { data: nova, error } = await db.from('reunioes').insert({
    obra_id: _obra.id, titulo, data, local: $('nr-local').value.trim()
  }).select('id').single();
  if (error) return falhar(erro, 'Não consegui criar: ' + error.message);
  $('folha-reuniao').hidden = true;
  await carregarReunioes();
  await abrirAta(nova.id);
});

async function abrirAta(id) {
  irPara('ata');
  const [rn, parts, tops] = await Promise.all([
    db.from('reunioes').select('*').eq('id', id).single(),
    db.from('reuniao_participantes').select('id, contrato_id, nome, cargo, responsavel')
      .eq('reuniao_id', id).order('nome'),
    db.from('reuniao_topicos').select('id, ordem, titulo, notas, decisao')
      .eq('reuniao_id', id).order('ordem')
  ]);
  if (rn.error) { falhar($('erro-ata'), 'Não consegui abrir a ata.'); return; }
  _reuniao = rn.data; _participantes = parts.data || []; _topicos = tops.data || [];

  $('at-obra').textContent = _obra.codigo + ' · ' + _obra.nome;
  $('at-titulo').textContent = _reuniao.titulo;
  $('at-quando').textContent = dataBR(_reuniao.data);

  document.querySelectorAll('#tela-ata [data-rn]').forEach(el => {
    const c = el.dataset.rn;
    el.value = _reuniao[c] == null ? '' : _reuniao[c];
  });

  renderParticipantes();
  renderTopicos();
}

function ligarCamposDaAta() {
  document.querySelectorAll('#tela-ata [data-rn]').forEach(el => {
    el.addEventListener('blur', async () => {
      if (!_reuniao) return;
      const campo = el.dataset.rn;
      const valor = el.value === '' ? null : el.value;
      if ((_reuniao[campo] == null ? '' : String(_reuniao[campo])) === (valor == null ? '' : valor)) return;
      const { error } = await db.from('reunioes').update({ [campo]: valor }).eq('id', _reuniao.id);
      if (error) {
        el.value = _reuniao[campo] == null ? '' : _reuniao[campo];
        return falhar($('erro-ata'), /reunioes_check/.test(error.message)
          ? 'A hora de fim não pode ser antes da hora de início.'
          : 'Não consegui gravar: ' + error.message);
      }
      _reuniao[campo] = valor;
      $('erro-ata').hidden = true;
      if (campo === 'data') $('at-quando').textContent = dataBR(valor);
      const s = $('at-gravou'); s.hidden = false;
      setTimeout(() => { s.hidden = true; }, 1800);
    });
  });
}

function renderParticipantes() {
  const area = $('at-participantes');
  if (!_participantes.length) {
    area.innerHTML = vazioHTML('Ninguém registrado ainda.');
    return;
  }
  area.innerHTML = '<div class="pilha"></div>';
  const cx = area.firstElementChild;
  _participantes.forEach(p => {
    const b = document.createElement('button');
    b.type='button'; b.className='item';
    const corpo = document.createElement('span'); corpo.className='corpo';
    const t = document.createElement('b'); t.textContent = p.nome;
    const s = document.createElement('small'); s.textContent = p.cargo || '';
    corpo.append(t, s); b.appendChild(corpo);
    if (p.responsavel) {
      const c = document.createElement('span'); c.className='chip'; c.dataset.tipo='cliente';
      c.textContent = 'Responsável'; b.appendChild(c);
    }
    b.addEventListener('click', () => abrirParticipante(p));
    cx.appendChild(b);
  });
}

async function abrirParticipante(p) {
  if (!_efetivo.length) await carregarEfetivoSilencioso();
  _ptEditando = p || null;
  const sel = $('pt-contrato');
  sel.innerHTML = '<option value="">— digitar à mão —</option>';
  _efetivo.forEach(e => {
    const o = document.createElement('option');
    o.value = e.contrato_id; o.textContent = e.nome + ' · ' + e.funcao;
    if (p && p.contrato_id === e.contrato_id) o.selected = true;
    sel.appendChild(o);
  });
  $('pt-nome').value = p ? p.nome : '';
  $('pt-cargo').value = p && p.cargo ? p.cargo : '';
  $('pt-responsavel').checked = p ? p.responsavel : false;
  $('btn-apagar-participante').hidden = !p;
  $('erro-participante').hidden = true;
  $('folha-participante').hidden = false;
}

// Escolher do efetivo preenche nome e cargo: menos digitação no celular.
$('pt-contrato').addEventListener('change', () => {
  const e = _efetivo.find(x => x.contrato_id === $('pt-contrato').value);
  if (!e) return;
  $('pt-nome').value = e.nome;
  if (!$('pt-cargo').value) $('pt-cargo').value = e.funcao || '';
});

$('btn-add-participante').addEventListener('click', () => abrirParticipante(null));
$('btn-fechar-participante').addEventListener('click', () => { $('folha-participante').hidden = true; });
$('folha-participante').addEventListener('click', (ev) => {
  if (ev.target === $('folha-participante')) $('folha-participante').hidden = true;
});

$('form-participante').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-participante'); erro.hidden = true;
  const nome = $('pt-nome').value.trim();
  if (!nome) return falhar(erro, 'Informe o nome do participante.');
  const linha = { nome, cargo: $('pt-cargo').value.trim(),
                  responsavel: $('pt-responsavel').checked,
                  contrato_id: $('pt-contrato').value || null };
  const { error } = _ptEditando
    ? await db.from('reuniao_participantes').update(linha).eq('id', _ptEditando.id)
    : await db.from('reuniao_participantes').insert({ ...linha, reuniao_id: _reuniao.id });
  if (error) return falhar(erro, /reuniao_participantes_reuniao_id_nome_key|unique/i.test(error.message)
    ? nome + ' já está na lista desta reunião.'
    : 'Não consegui salvar: ' + error.message);
  $('folha-participante').hidden = true;
  await abrirAta(_reuniao.id);
});

$('btn-apagar-participante').addEventListener('click', async () => {
  if (!_ptEditando) return;
  await db.from('reuniao_participantes').delete().eq('id', _ptEditando.id);
  $('folha-participante').hidden = true;
  await abrirAta(_reuniao.id);
});

function renderTopicos() {
  const area = $('at-topicos');
  if (!_topicos.length) {
    area.innerHTML = vazioHTML('Nenhum tópico.',
      'É aqui que a reunião vira documento: assunto, o que foi dito e o que ficou decidido.');
    return;
  }
  area.innerHTML = '<div class="pilha"></div>';
  const cx = area.firstElementChild;
  _topicos.forEach(t => {
    const b = document.createElement('button');
    b.type='button'; b.className='item';
    const corpo = document.createElement('span'); corpo.className='corpo';
    const tt = document.createElement('b'); tt.textContent = t.ordem + '. ' + t.titulo;
    const s = document.createElement('small');
    s.textContent = t.decisao ? 'Decisão: ' + t.decisao : (t.notas || 'sem anotação');
    corpo.append(tt, s); b.appendChild(corpo);
    b.addEventListener('click', () => abrirTopico(t));
    cx.appendChild(b);
  });
}

function abrirTopico(t) {
  _tpEditando = t || null;
  $('tp-titulo').value  = t ? t.titulo : '';
  $('tp-notas').value   = t && t.notas ? t.notas : '';
  $('tp-decisao').value = t && t.decisao ? t.decisao : '';
  $('tp-tarefa').checked = false;
  // Só oferece virar tarefa em tópico novo: repetir a criação a cada
  // edição encheria as tarefas de duplicata.
  $('caixa-vira-tarefa').hidden = !!t;
  $('btn-apagar-topico').hidden = !t;
  $('erro-topico').hidden = true;
  $('folha-topico').hidden = false;
}

$('btn-add-topico').addEventListener('click', () => abrirTopico(null));
$('btn-fechar-topico').addEventListener('click', () => { $('folha-topico').hidden = true; });
$('folha-topico').addEventListener('click', (ev) => {
  if (ev.target === $('folha-topico')) $('folha-topico').hidden = true;
});

$('form-topico').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-topico'); erro.hidden = true;
  const titulo = $('tp-titulo').value.trim();
  if (!titulo) return falhar(erro, 'O tópico precisa de um assunto.');

  const linha = { titulo, notas: $('tp-notas').value.trim(),
                  decisao: $('tp-decisao').value.trim() };
  let novoId = null;
  if (_tpEditando) {
    const { error } = await db.from('reuniao_topicos').update(linha).eq('id', _tpEditando.id);
    if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  } else {
    const ordem = _topicos.reduce((m, t) => Math.max(m, t.ordem), 0) + 1;
    const { data, error } = await db.from('reuniao_topicos')
      .insert({ ...linha, reuniao_id: _reuniao.id, ordem }).select('id').single();
    if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
    novoId = data.id;
  }

  // O tópico vira tarefa com origem 'reuniao' e fica ligado a ela pela
  // pauta — assim a ata e a lista de tarefas contam a mesma história.
  if (novoId && $('tp-tarefa').checked) {
    const { data: tarefa, error: e1 } = await db.from('tarefas').insert({
      obra_id: _obra.id, assunto: titulo,
      descricao: [linha.notas, linha.decisao].filter(Boolean).join('\n\n') || null,
      criador: _perfilNome || null, status: 'aberta', prioridade: 'media',
      data_lancamento: _reuniao.data, reuniao_id: _reuniao.id, origem: 'reuniao'
    }).select('id').single();
    if (e1) return falhar(erro, 'O tópico foi salvo, mas não consegui criar a tarefa: ' + e1.message);
    await db.from('reuniao_pauta').insert({
      reuniao_id: _reuniao.id, tarefa_id: tarefa.id,
      ordem: _topicos.length + 1
    });
  }

  $('folha-topico').hidden = true;
  await abrirAta(_reuniao.id);
});

$('btn-apagar-topico').addEventListener('click', async () => {
  if (!_tpEditando) return;
  await db.from('reuniao_topicos').delete().eq('id', _tpEditando.id);
  $('folha-topico').hidden = true;
  await abrirAta(_reuniao.id);
});

/* ============================================================
   DOCUMENTOS E MURAL
   O documento guarda o link, não o arquivo — mesma decisão das
   fotos do RDO. O mural é o recado curto da semana.
   ============================================================ */

const CATEGORIAS_DOC = ['Contrato','Cronograma','Programação Semanal','Orçamento','Outros'];

let _documentos = [];
let _recados = [];
let _dcFiltro = 'todas';
let _dcEditando = null;
let _rcEditando = null;

async function carregarDocumentos() {
  $('dc-titulo').textContent = _obra ? _obra.nome : '—';
  const area = $('dc-lista');
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Carregando…');
  const [docs, mural] = await Promise.all([
    db.from('documentos')
      .select('id, categoria, titulo, url, arquivo_nome, valor_orcamento, data_cronograma, notas')
      .eq('obra_id', _obra.id).order('categoria'),
    db.from('mural').select('id, autor, texto, criado_em')
      .eq('obra_id', _obra.id).order('criado_em', { ascending: false }).limit(20)
  ]);
  if (docs.error) { area.innerHTML = vazioHTML('Não consegui ler os documentos.', docs.error.message); return; }
  _documentos = docs.data || [];
  _recados = mural.error ? [] : (mural.data || []);

  const orcado = _documentos.reduce((s, d) => s + Number(d.valor_orcamento || 0), 0);
  const proxCrono = _documentos.map(d => d.data_cronograma)
    .filter(d => d && d >= hojeISO()).sort()[0];
  const tiles = [
    { rot:'Documentos', val: _documentos.length, sub:'nesta obra' },
    { rot:'Orçamentos', val: reais(orcado),
      sub: plural(_documentos.filter(d=>d.valor_orcamento).length,'com valor','com valor') },
    { rot:'Próximo cronograma', val: proxCrono ? dataBR(proxCrono) : '—',
      sub: proxCrono ? 'data marcada' : 'nenhum marcado' },
    { rot:'Recados', val: _recados.length, sub:'no mural' }
  ];
  const nums = $('dc-numeros'); nums.innerHTML='';
  tiles.forEach(t => {
    const d = document.createElement('div'); d.className='num';
    const r = document.createElement('p'); r.className='rotulo'; r.textContent=t.rot;
    const v = document.createElement('b'); v.textContent=t.val;
    if (String(t.val).startsWith('R$') || String(t.val).includes('/')) v.style.fontSize = '19px';
    const s = document.createElement('small'); s.textContent=t.sub;
    d.append(r,v,s); nums.appendChild(d);
  });

  renderMural();
  renderDcFiltros();
  filtrarDocumentos();
}

function renderMural() {
  const area = $('dc-mural');
  if (!_recados.length) {
    area.innerHTML = vazioHTML('Mural vazio.', 'Recado curto, para todo mundo ver ao abrir o app.');
    return;
  }
  area.innerHTML = '<div class="pilha"></div>';
  const cx = area.firstElementChild;
  _recados.forEach(r => {
    const b = document.createElement('button');
    b.type='button'; b.className='recado'; b.style.textAlign='left';
    b.style.width='100%'; b.style.border='none'; b.style.cursor='pointer';
    b.style.borderLeft='3px solid var(--accent-mark)';
    const p = document.createElement('p'); p.textContent = r.texto;
    const s = document.createElement('small');
    s.textContent = r.autor + ' · ' + dataBR(String(r.criado_em).slice(0,10));
    b.append(p, s);
    b.addEventListener('click', () => abrirRecado(r));
    cx.appendChild(b);
  });
}

function renderDcFiltros() {
  const opcoes = [['todas','Todas', _documentos.length]].concat(
    CATEGORIAS_DOC.map(c => [c, c, _documentos.filter(d => d.categoria === c).length])
      .filter(o => o[2] > 0));
  const area = $('dc-filtros'); area.innerHTML='';
  opcoes.forEach(([v, rot, n]) => {
    const b = document.createElement('button');
    b.type='button'; b.className='filtro';
    b.setAttribute('aria-pressed', String(_dcFiltro === v));
    b.textContent = rot + ' (' + n + ')';
    b.addEventListener('click', () => { _dcFiltro = v; renderDcFiltros(); filtrarDocumentos(); });
    area.appendChild(b);
  });
}

function filtrarDocumentos() {
  const termo = ($('busca-dc').value || '').trim().toLowerCase();
  let vistos = _documentos;
  if (_dcFiltro !== 'todas') vistos = vistos.filter(d => d.categoria === _dcFiltro);
  if (termo) vistos = vistos.filter(d =>
    [d.titulo, d.categoria, d.notas].filter(Boolean).join(' ').toLowerCase().includes(termo));

  const area = $('dc-lista');
  if (!_documentos.length) {
    area.innerHTML = vazioHTML('Nenhum documento nesta obra.',
      'Guarde aqui o link do contrato, do cronograma e da programação da semana.');
    return;
  }
  if (!vistos.length) { area.innerHTML = vazioHTML('Nada neste filtro.'); return; }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  vistos.forEach(d => {
    const b = document.createElement('button');
    b.type='button'; b.className='pessoa';
    const tarja = document.createElement('span'); tarja.className='tarja';
    const miolo = document.createElement('span'); miolo.className='miolo';
    const nm = document.createElement('span'); nm.className='nm'; nm.textContent = d.titulo;
    const sub = document.createElement('span'); sub.className='sub';
    sub.textContent = [d.arquivo_nome,
      d.valor_orcamento ? reais(d.valor_orcamento) : null,
      d.data_cronograma ? dataBR(d.data_cronograma) : null,
      d.url].filter(Boolean).join(' · ');
    miolo.append(nm, sub);
    const lado = document.createElement('span'); lado.className='lado';
    const c = document.createElement('span'); c.className='chip'; c.dataset.cat=d.categoria;
    c.textContent = d.categoria; lado.appendChild(c);
    b.append(tarja, miolo, lado);
    b.addEventListener('click', () => abrirDocumento(d));
    cx.appendChild(b);
  });
}
$('busca-dc').addEventListener('input', filtrarDocumentos);

// Valor só faz sentido em orçamento; data, em cronograma e programação.
function ajustarCamposDoc() {
  const c = $('dc-categoria').value;
  $('campo-valor').hidden = c !== 'Orçamento';
  $('campo-cronograma').hidden = !['Cronograma','Programação Semanal'].includes(c);
}
$('dc-categoria').addEventListener('change', ajustarCamposDoc);

function abrirDocumento(d) {
  _dcEditando = d || null;
  $('titulo-documento').textContent = d ? d.titulo : 'Novo documento';
  $('dc-categoria').value = d ? d.categoria : 'Outros';
  $('dc-doc-titulo').value = d ? d.titulo : '';
  $('dc-url').value = d ? d.url : '';
  $('dc-valor').value = d && d.valor_orcamento != null ? d.valor_orcamento : '';
  $('dc-data').value = d && d.data_cronograma ? d.data_cronograma : '';
  $('dc-notas').value = d && d.notas ? d.notas : '';
  $('btn-apagar-documento').hidden = !d;
  $('erro-documento').hidden = true;
  ajustarCamposDoc();
  $('folha-documento').hidden = false;
}
$('btn-novo-documento').addEventListener('click', () => abrirDocumento(null));
$('btn-fechar-documento').addEventListener('click', () => { $('folha-documento').hidden = true; });
$('folha-documento').addEventListener('click', (ev) => {
  if (ev.target === $('folha-documento')) $('folha-documento').hidden = true;
});

$('form-documento').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-documento'); erro.hidden = true;
  const titulo = $('dc-doc-titulo').value.trim();
  const url = $('dc-url').value.trim();
  const cat = $('dc-categoria').value;
  if (!titulo) return falhar(erro, 'O documento precisa de um título.');
  if (!url)    return falhar(erro, 'Cole o link do arquivo.');
  if (!/^https?:\/\//i.test(url))
    return falhar(erro, 'O link precisa começar com https://.');

  const linha = {
    categoria: cat, titulo, url,
    valor_orcamento: cat === 'Orçamento' && $('dc-valor').value !== ''
      ? Number($('dc-valor').value) : null,
    data_cronograma: ['Cronograma','Programação Semanal'].includes(cat) && $('dc-data').value
      ? $('dc-data').value : null,
    notas: $('dc-notas').value.trim()
  };
  const { error } = _dcEditando
    ? await db.from('documentos').update(linha).eq('id', _dcEditando.id)
    : await db.from('documentos').insert({ ...linha, obra_id: _obra.id });
  if (error) return falhar(erro, 'Não consegui salvar: ' + error.message);
  $('folha-documento').hidden = true;
  await carregarDocumentos();
  await carregarPainel();
});

$('btn-apagar-documento').addEventListener('click', async () => {
  if (!_dcEditando) return;
  await db.from('documentos').delete().eq('id', _dcEditando.id);
  $('folha-documento').hidden = true;
  await carregarDocumentos();
  await carregarPainel();
});

/* ---------- mural ---------- */
function abrirRecado(r) {
  _rcEditando = r || null;
  $('rc-texto').value = r ? r.texto : '';
  $('rc-autor').value = r ? r.autor : (_perfilNome || '');
  $('btn-apagar-recado').hidden = !r;
  $('erro-recado').hidden = true;
  $('folha-recado').hidden = false;
}
$('btn-novo-recado').addEventListener('click', () => abrirRecado(null));
$('btn-fechar-recado').addEventListener('click', () => { $('folha-recado').hidden = true; });
$('folha-recado').addEventListener('click', (ev) => {
  if (ev.target === $('folha-recado')) $('folha-recado').hidden = true;
});

$('form-recado').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-recado'); erro.hidden = true;
  const texto = $('rc-texto').value.trim();
  const autor = $('rc-autor').value.trim();
  if (!texto) return falhar(erro, 'Escreva o recado.');
  if (!autor) return falhar(erro, 'Diga quem está publicando.');
  const { error } = _rcEditando
    ? await db.from('mural').update({ texto, autor }).eq('id', _rcEditando.id)
    : await db.from('mural').insert({ obra_id: _obra.id, texto, autor });
  if (error) return falhar(erro, 'Não consegui publicar: ' + error.message);
  $('folha-recado').hidden = true;
  await carregarDocumentos();
});

$('btn-apagar-recado').addEventListener('click', async () => {
  if (!_rcEditando) return;
  await db.from('mural').delete().eq('id', _rcEditando.id);
  $('folha-recado').hidden = true;
  await carregarDocumentos();
});

ligarCamposDaAta();

/* ============================================================
   CHUVA E PARALISAÇÃO
   A conta mora na vw_chuva_mes. Aqui só se desenha.

   As faixas são estados numa ordem — praticável, parcialmente
   impraticável, impraticável, sem condição informada. Ordem fixa,
   número escrito em cada faixa e legenda: a cor nunca é a única
   informação, porque nem todo mundo separa verde de âmbar.
   ============================================================ */

const FAIXAS_CHUVA = [
  { campo:'dias_praticavel',    rot:'Praticável',               cor:'var(--ok)' },
  { campo:'dias_parcial',       rot:'Parcialmente impraticável', cor:'var(--warn)' },
  { campo:'dias_impraticavel',  rot:'Impraticável',             cor:'var(--danger)' },
  { campo:'dias_sem_condicao',  rot:'Sem condição informada',    cor:'var(--ink-faint)' }
];

const MES_CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function rotuloMes(iso) {
  const [a, m] = iso.split('-');
  return MES_CURTO[Number(m) - 1] + '/' + a.slice(2);
}

async function carregarChuva() {
  const cartao = $('cartao-chuva');
  if (!_obra) { cartao.hidden = true; return; }

  const { data, error } = await db.from('vw_chuva_mes')
    .select('mes, dias_com_rdo, dias_com_chuva, dias_chuva_manha, dias_chuva_tarde, ' +
            'dias_impraticavel, dias_parcial, dias_praticavel, dias_sem_condicao, dias_perdidos')
    .eq('obra', _obra.codigo).order('mes', { ascending: false }).limit(12);

  if (error || !data || !data.length) { cartao.hidden = true; return; }
  cartao.hidden = false;

  const meses = data.slice().reverse();   // do mais antigo para o mais novo
  const total = (campo) => meses.reduce((s, m) => s + Number(m[campo] || 0), 0);
  const perdidos = meses.reduce((s, m) => s + Number(m.dias_perdidos || 0), 0);

  // O período entra na frase em vez de disputar a linha do título: em
  // 390px os dois juntos quebravam em duas linhas cada.
  $('chuva-resumo').textContent =
    `Últimos ${plural(meses.length, 'mês', 'meses')} · ` +
    `${plural(total('dias_com_rdo'), 'dia com diário', 'dias com diário')} · ` +
    `${plural(total('dias_com_chuva'), 'dia com chuva', 'dias com chuva')} · ` +
    `${perdidos.toLocaleString('pt-BR')} ${perdidos === 1 ? 'dia perdido' : 'dias perdidos'}`;

  const leg = $('chuva-legenda'); leg.innerHTML = '';
  FAIXAS_CHUVA.forEach(f => {
    if (!total(f.campo)) return;          // faixa que não existe no período não entra
    const li = document.createElement('li');
    const i = document.createElement('i'); i.style.setProperty('--cor', f.cor);
    li.append(i, document.createTextNode(f.rot + ' · ' + total(f.campo)));
    leg.appendChild(li);
  });

  // Uma escala só para todos os meses: a largura da barra é o número de
  // dias lançados naquele mês em relação ao mês mais cheio. Assim mês
  // com meio diário não parece igual a mês inteiro.
  const maior = Math.max(...meses.map(m => Number(m.dias_com_rdo || 0)), 1);

  const area = $('chuva-meses'); area.innerHTML = '';
  meses.forEach(m => {
    const linha = document.createElement('div');
    linha.className = 'mes-chuva' + (Number(m.dias_com_rdo) ? '' : ' vazio');

    const quando = document.createElement('span');
    quando.className = 'quando'; quando.textContent = rotuloMes(m.mes);

    const barra = document.createElement('div');
    barra.className = 'barra';
    barra.style.width = (100 * Number(m.dias_com_rdo) / maior) + '%';

    FAIXAS_CHUVA.forEach(f => {
      const n = Number(m[f.campo] || 0);
      if (!n) return;
      const s = document.createElement('span');
      s.style.setProperty('--cor', f.cor);
      s.style.flex = n;
      s.title = f.rot + ': ' + plural(n, 'dia', 'dias') + ' em ' + rotuloMes(m.mes);
      // o número só cabe dentro da faixa quando ela é larga o bastante;
      // de qualquer jeito ele está escrito na linha de baixo
      if (n / Number(m.dias_com_rdo) > 0.14) s.textContent = n;
      barra.appendChild(s);
    });

    const conta = document.createElement('span');
    conta.className = 'conta';
    const b = document.createElement('b');
    b.textContent = Number(m.dias_perdidos).toLocaleString('pt-BR');
    conta.append(
      document.createTextNode(m.dias_com_chuva + ' com chuva · '),
      b,
      document.createTextNode(Number(m.dias_perdidos) === 1 ? ' dia perdido' : ' dias perdidos'));

    linha.append(quando, barra, conta);
    area.appendChild(linha);
  });
}

/* ============================================================
   CALENDÁRIO DO RDO
   O dia que falta é a informação principal: numa lista ele não
   aparece, porque lista só mostra o que existe. Aqui o dia útil
   passado sem diário fica vermelho e clicável — toca e já abre
   a folha do novo RDO naquela data.
   ============================================================ */

const CONDICAO_COR = {
  praticavel:                'var(--ok)',
  parcialmente_impraticavel: 'var(--warn)',
  impraticavel:              'var(--danger)'
};

let _mesCal = null;   // 'AAAA-MM'

function primeiroDoMes(mes) { return mes + '-01'; }
function ultimoDoMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
function somarMes(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

async function carregarCalendario() {
  if (!_obra) { $('cartao-calendario').hidden = true; return; }
  $('cartao-calendario').hidden = false;
  if (!_mesCal) _mesCal = hojeISO().slice(0, 7);

  const ini = primeiroDoMes(_mesCal), fim = ultimoDoMes(_mesCal);
  const { data } = await db.from('rdos')
    .select('id, numero, data, condicao_trabalho')
    .eq('obra_id', _obra.id).gte('data', ini).lte('data', fim).order('data');

  const porDia = {};
  (data || []).forEach(r => { porDia[r.data] = r; });

  $('cal-mes').textContent = new Intl.DateTimeFormat('pt-BR',
    { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(ini + 'T12:00:00Z'));

  // Não deixo navegar para mês que ainda não começou: não há diário
  // possível lá, e o botão que não leva a nada só confunde.
  $('cal-depois').disabled = somarMes(_mesCal, 1) > hojeISO().slice(0, 7);

  const grade = $('cal-grade');
  grade.innerHTML = '';

  const totalDias = Number(fim.slice(8));
  const primeiroDiaSemana = new Date(ini + 'T12:00:00Z').getUTCDay();
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement('button');
    vazio.type = 'button'; vazio.className = 'dia'; vazio.disabled = true;
    vazio.dataset.estado = 'fora'; vazio.tabIndex = -1;
    grade.appendChild(vazio);
  }

  const hoje = hojeISO();
  let faltando = 0, comDiario = 0;

  for (let d = 1; d <= totalDias; d++) {
    const iso = _mesCal + '-' + String(d).padStart(2, '0');
    const rdo = porDia[iso];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'dia';
    if (iso === hoje) b.dataset.hoje = 'sim';

    const n = document.createElement('span'); n.className = 'n'; n.textContent = d;
    b.appendChild(n);

    if (rdo) {
      comDiario++;
      b.dataset.estado = 'tem';
      b.title = `RDO nº ${rdo.numero} — ${dataBR(iso)}`;
      const pt = document.createElement('span');
      pt.className = 'pt';
      pt.style.setProperty('--cor', CONDICAO_COR[rdo.condicao_trabalho] || 'var(--ink-faint)');
      b.appendChild(pt);
      b.addEventListener('click', () => abrirRDO(rdo.id));
    } else if (iso > hoje) {
      b.dataset.estado = 'futuro';
      b.disabled = true;
      b.title = dataBR(iso) + ' — ainda não chegou';
    } else {
      faltando++;
      b.dataset.estado = 'falta';
      b.title = 'Sem diário em ' + dataBR(iso) + ' — toque para lançar';
      b.addEventListener('click', () => {
        abrirFolhaNovoRDO();
        $('n-data').value = iso;
        explicarNovoRDO();
      });
    }
    grade.appendChild(b);
  }

  const resumo = $('cal-resumo');
  resumo.innerHTML = '';
  const b1 = document.createElement('b'); b1.textContent = comDiario;
  resumo.append(b1, document.createTextNode(
    (comDiario === 1 ? ' dia com diário' : ' dias com diário') + ' · '));
  const b2 = document.createElement('b');
  b2.textContent = faltando;
  if (faltando) b2.className = 'falta';
  resumo.append(b2, document.createTextNode(
    faltando === 1 ? ' dia sem lançar' : ' dias sem lançar'));

  const leg = $('cal-legenda');
  leg.innerHTML = '';
  const itens = [
    ['var(--ok)', 'Praticável'],
    ['var(--warn)', 'Parcialmente impraticável'],
    ['var(--danger)', 'Impraticável'],
    ['var(--ink-faint)', 'Sem condição informada']
  ].filter(([cor]) => (data || []).some(r =>
    (CONDICAO_COR[r.condicao_trabalho] || 'var(--ink-faint)') === cor));

  if (faltando) itens.push(['transparent', 'Dia sem diário — toque para lançar']);
  itens.forEach(([cor, rot]) => {
    const li = document.createElement('li');
    const i = document.createElement('i');
    i.style.setProperty('--cor', cor);
    if (cor === 'transparent') {
      i.style.background = 'var(--danger-weak)';
      i.style.border = '1px solid var(--danger)';
    }
    li.append(i, document.createTextNode(rot));
    leg.appendChild(li);
  });
}

$('cal-antes').addEventListener('click', () => {
  _mesCal = somarMes(_mesCal || hojeISO().slice(0, 7), -1);
  carregarCalendario();
});
$('cal-depois').addEventListener('click', () => {
  _mesCal = somarMes(_mesCal || hojeISO().slice(0, 7), 1);
  carregarCalendario();
});

/* ============================================================
   BUSCA EM TODA A OBRA
   Resolve o "não lembro onde lancei isso". Cada módulo já tem a
   sua busca; esta atravessa todos e leva direto ao registro.

   A procura é feita no banco, não no que está carregado na tela:
   o app só guarda o que você já abriu, e o que se procura é
   justamente o que não está à vista.
   ============================================================ */

// O termo entra num filtro do PostgREST separado por vírgula, e
// parêntese e vírgula quebram a sintaxe. Limpo antes de mandar.
function limparTermo(t) {
  return (t || '').trim().replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ');
}
const contem = (campos, termo) =>
  campos.map(c => `${c}.ilike.*${termo}*`).join(',');

let _relogioBusca = null;

async function buscarNaObra(termo) {
  const area = $('busca-resultado');
  const t = limparTermo(termo);

  if (t.length < 2) {
    area.innerHTML = '';
    if (termo.trim()) area.innerHTML = vazioHTML('Escreva pelo menos duas letras.');
    return;
  }
  if (!_obra) { area.innerHTML = vazioHTML('Nenhuma obra escolhida.'); return; }

  area.innerHTML = vazioHTML('Procurando…');

  const [efe, eq, tf, oc, epi, nf, dc, rn, mu, rdo] = await Promise.all([
    db.from('vw_efetivo').select('contrato_id, nome, funcao, matricula, cracha')
      .eq('obra', _obra.codigo).or(contem(['nome','matricula','cracha','funcao'], t)).limit(8),
    db.from('equipamentos').select('id, prefixo, tipo, marca, modelo, placa, ativo')
      .eq('obra_id', _obra.id).or(contem(['prefixo','tipo','marca','modelo','placa'], t)).limit(8),
    db.from('tarefas').select('id, assunto, responsavel, setor, status, prioridade, data_termino, data_lancamento, descricao, concluido_em')
      .eq('obra_id', _obra.id).or(contem(['assunto','responsavel','setor','descricao'], t)).limit(8),
    db.from('ocorrencias')
      .select('id, data, tipo, descricao, contrato_id, rdo_id, contrato:contratos!inner(obra_id, pessoa:pessoas(nome))')
      .eq('contrato.obra_id', _obra.id).ilike('descricao', `%${t}%`).limit(6),
    db.from('vw_ficha_epi').select('contrato_id, nome, epi, ca, data_entrega')
      .eq('obra', _obra.codigo).or(contem(['nome','epi','ca'], t)).limit(6),
    db.from('nfs').select('id, numero, serie, fornecedor, categoria, data, total')
      .eq('obra_id', _obra.id).or(contem(['numero','serie','fornecedor','categoria'], t)).limit(8),
    db.from('documentos').select('id, titulo, categoria, url, notas')
      .eq('obra_id', _obra.id).or(contem(['titulo','categoria','notas'], t)).limit(6),
    db.from('reunioes').select('id, titulo, data, local')
      .eq('obra_id', _obra.id).or(contem(['titulo','local'], t)).limit(6),
    db.from('mural').select('id, texto, autor, criado_em')
      .eq('obra_id', _obra.id).or(contem(['texto','autor'], t)).limit(6),
    db.from('rdos').select('id, numero, data, observacoes, apontador, dss_tema')
      .eq('obra_id', _obra.id).or(contem(['observacoes','apontador','dss_tema'], t)).limit(6)
  ]);

  const grupos = [
    { rot:'Efetivo', linhas:(efe.data||[]).map(p => ({
        nm:p.nome, sub:[p.funcao, p.matricula && 'mat. '+p.matricula].filter(Boolean).join(' · '),
        ir: async () => { irPara('efetivo'); await carregarEfetivo(); abrirPessoa(p.contrato_id); } })) },
    { rot:'Equipamentos', linhas:(eq.data||[]).map(e => ({
        nm:e.prefixo + ' · ' + e.tipo,
        sub:[e.marca, e.modelo, e.placa, e.ativo ? null : 'fora da frota'].filter(Boolean).join(' · '),
        ir: async () => { irPara('equipamentos'); await carregarEquipamentos(); abrirEquipamento(e); } })) },
    { rot:'Tarefas', linhas:(tf.data||[]).map(t2 => ({
        nm:t2.assunto,
        sub:[STATUS_TF[t2.status], t2.responsavel, t2.setor].filter(Boolean).join(' · '),
        ir: async () => { irPara('tarefas'); await carregarTarefas(); abrirTarefa(t2); } })) },
    { rot:'Ocorrências', linhas:(oc.data||[]).map(o => ({
        nm:(o.contrato && o.contrato.pessoa ? o.contrato.pessoa.nome : 'A obra'),
        sub:[NOME_TIPO_OC[o.tipo], dataBR(o.data), o.descricao].filter(Boolean).join(' · '),
        ir: async () => { irPara('ocorrencias'); await carregarOcorrencias();
                          const achada = _ocorrencias.find(x => x.id === o.id);
                          if (achada) abrirOcorrencia(achada); } })) },
    { rot:'EPI', linhas:(epi.data||[]).map(f => ({
        nm:f.nome, sub:[f.epi, f.ca && 'CA '+f.ca, dataBR(f.data_entrega)].filter(Boolean).join(' · '),
        ir: async () => { irPara('epi'); await carregarEPI(); } })) },
    { rot:'Notas fiscais', linhas:(nf.data||[]).map(n => ({
        nm:'nº ' + n.numero + (n.serie ? '/'+n.serie : '') + ' · ' + n.fornecedor,
        sub:[dataBR(n.data), n.categoria, reais(n.total)].filter(Boolean).join(' · '),
        ir: async () => { irPara('nfs'); await carregarNFs(); abrirNF(n.id); } })) },
    { rot:'Documentos', linhas:(dc.data||[]).map(d => ({
        nm:d.titulo, sub:[d.categoria, d.notas].filter(Boolean).join(' · '),
        ir: async () => { irPara('documentos'); await carregarDocumentos(); abrirDocumento(d); } })) },
    { rot:'Reuniões', linhas:(rn.data||[]).map(r => ({
        nm:r.titulo, sub:[dataBR(r.data), r.local].filter(Boolean).join(' · '),
        ir: async () => { irPara('reunioes'); await carregarReunioes(); abrirAta(r.id); } })) },
    { rot:'Mural', linhas:(mu.data||[]).map(m => ({
        nm:m.texto, sub:m.autor + ' · ' + dataBR(String(m.criado_em).slice(0,10)),
        ir: async () => { irPara('documentos'); await carregarDocumentos(); } })) },
    { rot:'RDO', linhas:(rdo.data||[]).map(r => ({
        nm:'RDO nº ' + r.numero + ' · ' + dataBR(r.data),
        sub:[r.apontador, r.dss_tema, r.observacoes].filter(Boolean).join(' · '),
        ir: async () => { irPara('rdo'); await carregarRDOs(); abrirRDO(r.id); } })) }
  ].filter(g => g.linhas.length);

  const quantos = grupos.reduce((s, g) => s + g.linhas.length, 0);

  if (!quantos) {
    area.innerHTML = vazioHTML('Nada encontrado com "' + termo.trim() + '".',
      'A busca olha nome, número, assunto e descrição — não o conteúdo de arquivo no Drive.');
    return;
  }

  area.innerHTML = '';
  grupos.forEach(g => {
    const bloco = document.createElement('div');
    bloco.className = 'grupo-busca';
    const rot = document.createElement('p');
    rot.className = 'rotulo';
    rot.textContent = g.rot + ' · ' + g.linhas.length;
    bloco.appendChild(rot);

    const lista = document.createElement('div');
    lista.className = 'lista';
    g.linhas.forEach(l => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'achado';
      const miolo = document.createElement('span'); miolo.className = 'miolo';
      const nm = document.createElement('span'); nm.className = 'nm';
      realcar(nm, l.nm, t);
      const sub = document.createElement('span'); sub.className = 'sub';
      realcar(sub, l.sub, t);
      miolo.append(nm, sub);
      b.appendChild(miolo);
      b.addEventListener('click', async () => {
        $('folha-busca').hidden = true;
        await l.ir();
      });
      lista.appendChild(b);
    });
    bloco.appendChild(lista);
    area.appendChild(bloco);
  });
}

// Marca o pedaço encontrado sem montar HTML com texto do banco:
// nome de fornecedor com "<" viraria tag se eu concatenasse string.
function realcar(el, texto, termo) {
  el.textContent = '';
  const t = String(texto || '');
  const alvo = termo.toLowerCase();
  let i = 0;
  while (i < t.length) {
    const achou = t.toLowerCase().indexOf(alvo, i);
    if (achou < 0 || !alvo) { el.append(t.slice(i)); break; }
    if (achou > i) el.append(t.slice(i, achou));
    const m = document.createElement('mark');
    m.textContent = t.slice(achou, achou + alvo.length);
    el.appendChild(m);
    i = achou + alvo.length;
  }
}

$('btn-busca').addEventListener('click', () => {
  $('busca-geral').value = '';
  $('busca-resultado').innerHTML = '';
  $('folha-busca').hidden = false;
  $('busca-geral').focus();
});
$('btn-fechar-busca').addEventListener('click', () => { $('folha-busca').hidden = true; });
$('folha-busca').addEventListener('click', (ev) => {
  if (ev.target === $('folha-busca')) $('folha-busca').hidden = true;
});

// Espera a digitação parar: dez consultas a cada tecla derrubariam a
// mão de qualquer conexão de canteiro.
$('busca-geral').addEventListener('input', () => {
  clearTimeout(_relogioBusca);
  const v = $('busca-geral').value;
  _relogioBusca = setTimeout(() => buscarNaObra(v), 300);
});

/* ============================================================
   PDF DO DIÁRIO
   Monta uma folha A4 com o conteúdo do RDO e chama a impressão
   do próprio navegador. Sem biblioteca: no iPhone é Compartilhar
   e "Salvar em Arquivos" como PDF, e no computador é imprimir
   em PDF. Menos peça para quebrar, e sai igual em todo aparelho.
   ============================================================ */

const CLIMA_IMP = (v) => v || '—';

function campoImp(rot, valor) {
  const d = document.createElement('div'); d.className = 'imp-campo';
  const b = document.createElement('b'); b.textContent = rot;
  const s = document.createElement('span'); s.textContent = valor == null || valor === '' ? '—' : valor;
  d.append(b, s);
  return d;
}

function secaoImp(titulo) {
  const s = document.createElement('section'); s.className = 'imp-secao';
  const h = document.createElement('h2'); h.textContent = titulo;
  s.appendChild(h);
  return s;
}

function tabelaImp(colunas, linhas, rodape) {
  const t = document.createElement('table'); t.className = 'imp';
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  colunas.forEach(c => { const th = document.createElement('th'); th.textContent = c.rot; tr.appendChild(th); });
  thead.appendChild(tr); t.appendChild(thead);
  const tb = document.createElement('tbody');
  linhas.forEach(l => {
    const tr2 = document.createElement('tr');
    colunas.forEach(c => {
      const td = document.createElement('td');
      if (c.num) td.className = 'imp-n';
      td.textContent = l[c.campo] == null ? '' : l[c.campo];
      tr2.appendChild(td);
    });
    tb.appendChild(tr2);
  });
  t.appendChild(tb);
  if (rodape) {
    const tf = document.createElement('tfoot');
    const tr3 = document.createElement('tr');
    rodape.forEach(r => {
      const td = document.createElement('td');
      if (r.num) td.className = 'imp-n';
      if (r.span) td.colSpan = r.span;
      td.textContent = r.txt;
      tr3.appendChild(td);
    });
    tf.appendChild(tr3); t.appendChild(tf);
  }
  return t;
}

async function montarImpressaoRDO() {
  if (!_rdo || !_obra) return false;
  const folha = $('folha-impressao');
  folha.innerHTML = '';

  // Recarrego as partes: a folha tem que sair com o que está gravado,
  // não com o que sobrou na memória da tela.
  const [pres, atv, eqp, fts] = await Promise.all([
    db.from('rdo_presencas')
      .select('horas_normais, horas_extras, situacao, observacao, ' +
              'contrato:contratos(matricula, pessoa:pessoas(nome), funcao:funcoes(nome))')
      .eq('rdo_id', _rdo.id),
    db.from('rdo_atividades').select('descricao, local, percentual_executado').eq('rdo_id', _rdo.id),
    db.from('rdo_equipamentos')
      .select('horas_operando, horas_paradas, motivo_parada, equipamento:equipamentos(prefixo, tipo)')
      .eq('rdo_id', _rdo.id),
    db.from('rdo_fotos').select('url_drive, legenda, ordem').eq('rdo_id', _rdo.id).order('ordem')
  ]);

  const presencas = (pres.data || []).sort((a, b) =>
    (a.contrato?.pessoa?.nome || '').localeCompare(b.contrato?.pessoa?.nome || '', 'pt-BR'));

  /* cabeçalho */
  const topo = document.createElement('div'); topo.className = 'imp-topo';
  const esq = document.createElement('div');
  const h1 = document.createElement('h1'); h1.textContent = 'Relatório Diário de Obra';
  const sub = document.createElement('p'); sub.className = 'sub';
  sub.textContent = [_obra.codigo + ' — ' + _obra.nome,
                     [_obra.cidade, _obra.uf].filter(Boolean).join('/'),
                     _obra.empresa_executora, _obra.consorcio].filter(Boolean).join(' · ');
  esq.append(h1, sub);
  const num = document.createElement('span'); num.className = 'imp-num';
  num.textContent = 'Nº ' + _rdo.numero + '  ·  ' + dataBR(_rdo.data);
  topo.append(esq, num);
  folha.appendChild(topo);

  /* condições */
  const s1 = secaoImp('Condições do dia');
  const g1 = document.createElement('div'); g1.className = 'imp-campos';
  const semana = new Intl.DateTimeFormat('pt-BR', { timeZone:'UTC', weekday:'long' })
    .format(new Date(_rdo.data + 'T12:00:00Z'));
  g1.append(
    campoImp('Dia da semana', semana),
    campoImp('Clima manhã', CLIMA_IMP(_rdo.clima_manha)),
    campoImp('Clima tarde', CLIMA_IMP(_rdo.clima_tarde)),
    campoImp('Condição', CONDICAO[_rdo.condicao_trabalho] || '—'));
  s1.appendChild(g1);
  const g2 = document.createElement('div'); g2.className = 'imp-campos tres';
  g2.style.marginTop = '4pt';
  g2.append(
    campoImp('Jornada', _rdo.jornada),
    campoImp('Apontador', _rdo.apontador),
    campoImp('DSS', [_rdo.dss_horario ? String(_rdo.dss_horario).slice(0,5) : null,
                     _rdo.dss_tema].filter(Boolean).join(' — ')));
  s1.appendChild(g2);
  if (_rdo.dss_ministrado_por) {
    const g3 = document.createElement('div'); g3.className = 'imp-campos tres';
    g3.style.marginTop = '4pt';
    g3.append(campoImp('DSS ministrado por', _rdo.dss_ministrado_por));
    s1.appendChild(g3);
  }
  folha.appendChild(s1);

  /* efetivo */
  const s2 = secaoImp('Efetivo do dia');
  const rotSit = Object.fromEntries(SITUACOES);
  const linhas = presencas.map(p => ({
    nome: p.contrato?.pessoa?.nome || '—',
    funcao: p.contrato?.funcao?.nome || '',
    mat: p.contrato?.matricula || '',
    sit: rotSit[p.situacao] || p.situacao,
    hn: Number(p.horas_normais).toLocaleString('pt-BR'),
    he: Number(p.horas_extras) ? Number(p.horas_extras).toLocaleString('pt-BR') : ''
  }));
  const presentes = presencas.filter(p => p.situacao === 'presente');
  const hh = presentes.reduce((s, p) =>
    s + Number(p.horas_normais || 0) + Number(p.horas_extras || 0), 0);

  if (linhas.length) {
    s2.appendChild(tabelaImp(
      [{ rot:'Nome', campo:'nome' }, { rot:'Função', campo:'funcao' },
       { rot:'Matrícula', campo:'mat' }, { rot:'Situação', campo:'sit' },
       { rot:'H. normais', campo:'hn', num:true }, { rot:'H. extras', campo:'he', num:true }],
      linhas,
      [{ txt:`${presentes.length} presente(s) de ${presencas.length}`, span:4 },
       { txt: hh.toLocaleString('pt-BR'), num:true },
       { txt:'homem-hora', num:false }]));
  } else {
    const p = document.createElement('p'); p.className = 'imp-texto';
    p.textContent = 'Nenhum efetivo lançado neste dia.';
    s2.appendChild(p);
  }
  folha.appendChild(s2);

  /* atividades */
  const s3 = secaoImp('Atividades executadas');
  if ((atv.data || []).length) {
    s3.appendChild(tabelaImp(
      [{ rot:'Descrição', campo:'descricao' }, { rot:'Local', campo:'local' },
       { rot:'% exec.', campo:'pct', num:true }],
      atv.data.map(a => ({ descricao:a.descricao, local:a.local || '',
        pct: a.percentual_executado == null ? '' : Number(a.percentual_executado).toLocaleString('pt-BR') + '%' }))));
  } else {
    const p = document.createElement('p'); p.className = 'imp-texto';
    p.textContent = 'Nenhuma atividade lançada.';
    s3.appendChild(p);
  }
  folha.appendChild(s3);

  /* equipamentos */
  if ((eqp.data || []).length) {
    const s4 = secaoImp('Equipamentos');
    s4.appendChild(tabelaImp(
      [{ rot:'Prefixo', campo:'pref' }, { rot:'Tipo', campo:'tipo' },
       { rot:'H. operando', campo:'op', num:true }, { rot:'H. paradas', campo:'par', num:true },
       { rot:'Motivo da parada', campo:'motivo' }],
      eqp.data.map(e => ({ pref:e.equipamento?.prefixo || '', tipo:e.equipamento?.tipo || '',
        op:Number(e.horas_operando).toLocaleString('pt-BR'),
        par:Number(e.horas_paradas).toLocaleString('pt-BR'),
        motivo:e.motivo_parada || '' }))));
    folha.appendChild(s4);
  }

  /* observações */
  const s5 = secaoImp('Observações');
  const o1 = document.createElement('p'); o1.className = 'imp-texto';
  o1.textContent = _rdo.observacoes || 'Sem observações.';
  s5.appendChild(o1);
  if (_rdo.eventos_meio_ambiente) {
    const h = document.createElement('b');
    h.style.cssText = 'display:block;font-size:7.5pt;text-transform:uppercase;margin-top:5pt';
    h.textContent = 'Meio ambiente';
    const o2 = document.createElement('p'); o2.className = 'imp-texto';
    o2.textContent = _rdo.eventos_meio_ambiente;
    s5.append(h, o2);
  }
  folha.appendChild(s5);

  /* fotos: o PDF leva o link, porque a foto mora no Drive */
  if ((fts.data || []).length) {
    const s6 = secaoImp('Fotos anexas');
    s6.appendChild(tabelaImp(
      [{ rot:'#', campo:'n', num:true }, { rot:'Legenda', campo:'leg' }, { rot:'Link', campo:'url' }],
      fts.data.map((f, i) => ({ n:i+1, leg:f.legenda || '', url:f.url_drive }))));
    folha.appendChild(s6);
  }

  /* assinaturas */
  const ass = document.createElement('div'); ass.className = 'imp-assina';
  const a1 = document.createElement('div');
  a1.textContent = _rdo.apontador ? _rdo.apontador + ' — Apontador' : 'Apontador';
  const a2 = document.createElement('div');
  a2.textContent = 'Engenheiro responsável';
  ass.append(a1, a2);
  folha.appendChild(ass);

  const rod = document.createElement('p'); rod.className = 'imp-rodape';
  rod.textContent = 'BUILDLy · ' + _obra.codigo + ' · RDO nº ' + _rdo.numero +
    ' de ' + dataBR(_rdo.data) + ' · emitido em ' + dataBR(hojeISO()) +
    (_perfilNome ? ' por ' + _perfilNome : '');
  folha.appendChild(rod);
  return true;
}

$('btn-imprimir-rdo').addEventListener('click', async () => {
  const b = $('btn-imprimir-rdo');
  b.disabled = true; b.textContent = 'Montando…';
  const pronto = await montarImpressaoRDO();
  b.disabled = false; b.textContent = 'Gerar PDF do diário';
  if (!pronto) return falhar($('erro-rdo'), 'Não consegui montar a folha do diário.');
  // O título da janela vira o nome sugerido do arquivo.
  const antes = document.title;
  document.title = `RDO ${_rdo.numero} - ${_obra.codigo} - ${_rdo.data}`;
  window.print();
  document.title = antes;
});

/* ============================================================
   AVISOS — o que o robô encontrou
   A varredura roda no banco às 6h, todo dia, pelo pg_cron. O app
   só lê o resultado. Por isso o aviso existe mesmo que ninguém
   tenha aberto o Buildly — que é justamente quando o prazo passa
   batido.
   ============================================================ */

const TIPO_AVISO = {
  experiencia:     'Experiência',
  viagem:          'Viagem',
  tarefa_atrasada: 'Tarefa',
  rdo_faltando:    'RDO',
  epi_vencido:     'EPI'
};

let _avisos = [];
let _verLidos = false;

async function carregarAvisos() {
  if (!_obra) { $('btn-avisos').hidden = true; return; }
  $('btn-avisos').hidden = false;

  const { data, error } = await db.from('avisos')
    .select('id, tipo, gravidade, titulo, detalhe, referencia, data_ref, lido_em')
    .eq('obra_id', _obra.id).order('data_ref', { ascending: true }).limit(200);

  if (error) { _avisos = []; return; }
  _avisos = data || [];

  const naoLidos = _avisos.filter(a => !a.lido_em).length;
  const sino = $('btn-avisos');
  sino.dataset.vazio = naoLidos ? 'nao' : 'sim';
  $('conta-avisos').textContent = naoLidos > 99 ? '99+' : naoLidos;
  sino.title = naoLidos
    ? plural(naoLidos, 'aviso não lido', 'avisos não lidos')
    : 'Nenhum aviso pendente';
}

function renderAvisos() {
  const area = $('avisos-lista');
  const vistos = _verLidos ? _avisos : _avisos.filter(a => !a.lido_em);
  $('btn-ver-lidos').textContent = _verLidos ? 'Esconder os lidos' : 'Ver também os lidos';

  if (!_avisos.length) {
    area.innerHTML = vazioHTML('Nenhum aviso.',
      'O robô roda às 6h. Se não há nada vencendo, ele não inventa aviso.');
    return;
  }
  if (!vistos.length) {
    area.innerHTML = vazioHTML('Tudo lido.', 'Toque em "Ver também os lidos" para rever.');
    return;
  }

  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;
  vistos.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'aviso-linha' + (a.lido_em ? ' lido' : '');
    b.dataset.grav = a.gravidade;

    const tarja = document.createElement('span'); tarja.className = 'tarja';
    const miolo = document.createElement('span'); miolo.className = 'miolo';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a.titulo;
    const sub = document.createElement('span'); sub.className = 'sub';
    sub.textContent = [TIPO_AVISO[a.tipo] || a.tipo, a.detalhe].filter(Boolean).join(' · ');
    miolo.append(nm, sub);

    const lado = document.createElement('span'); lado.className = 'lado';
    const chip = document.createElement('span'); chip.className = 'chip prazo';
    const dias = diasAte(a.data_ref);
    chip.dataset.nivel = a.gravidade === 'grave' ? 'grave' : 'atencao';
    chip.textContent = dias == null ? dataBR(a.data_ref) : prazoTexto(dias);
    lado.appendChild(chip);

    b.append(tarja, miolo, lado);
    b.addEventListener('click', () => irAtrasDoAviso(a));
    cx.appendChild(b);
  });
}

// Tocar no aviso leva ao lugar onde se resolve, e marca como lido.
// Aviso que não leva a lugar nenhum vira decoração.
async function irAtrasDoAviso(a) {
  if (!a.lido_em) {
    const { error } = await db.from('avisos')
      .update({ lido_em: new Date().toISOString() }).eq('id', a.id);
    if (!error) a.lido_em = new Date().toISOString();
  }
  $('folha-avisos').hidden = true;

  if (a.tipo === 'tarefa_atrasada') {
    irPara('tarefas'); await carregarTarefas();
    const t = _tarefas.find(x => x.id === a.referencia);
    if (t) abrirTarefa(t);
  } else if (a.tipo === 'rdo_faltando') {
    irPara('rdo'); await carregarRDOs();
    abrirFolhaNovoRDO();
    $('n-data').value = a.referencia;
    explicarNovoRDO();
  } else if (a.tipo === 'epi_vencido') {
    irPara('epi'); await carregarEPI();
  } else {
    // experiência e viagem se resolvem na ficha da pessoa
    irPara('efetivo'); await carregarEfetivo();
    const contrato = String(a.referencia).split(':')[0];
    if (_efetivo.some(p => p.contrato_id === contrato)) abrirPessoa(contrato);
  }
  await carregarAvisos();
}

$('btn-avisos').addEventListener('click', async () => {
  await carregarAvisos();
  _verLidos = false;
  renderAvisos();
  $('folha-avisos').hidden = false;
});
$('btn-fechar-avisos').addEventListener('click', () => { $('folha-avisos').hidden = true; });
$('folha-avisos').addEventListener('click', (ev) => {
  if (ev.target === $('folha-avisos')) $('folha-avisos').hidden = true;
});
$('btn-ver-lidos').addEventListener('click', () => { _verLidos = !_verLidos; renderAvisos(); });

$('btn-ler-todos').addEventListener('click', async () => {
  const pendentes = _avisos.filter(a => !a.lido_em);
  if (!pendentes.length) return;
  const agora = new Date().toISOString();
  for (const a of pendentes) {
    await db.from('avisos').update({ lido_em: agora }).eq('id', a.id);
    a.lido_em = agora;
  }
  await carregarAvisos();
  renderAvisos();
});

/* ============================================================
   PEDIDOS RECEBIDOS PELO FORMULÁRIO
   O pedido não vira tarefa sozinho. Alguém da obra lê, ajusta o
   assunto, põe responsável e prazo — e aí vira. Pedido virando
   tarefa direto encheria a lista de coisa sem dono.
   ============================================================ */

let _pedidos = [];
let _pdEditando = null;

function linkDoFormulario() {
  if (!_obra) return '';
  const base = location.href.replace(/\/[^/]*$/, '/');
  return base + 'pedido.html?obra=' + encodeURIComponent(_obra.codigo);
}

async function carregarPedidos() {
  if (!_obra) { $('bloco-pedidos').hidden = true; return; }
  $('link-formulario').textContent = linkDoFormulario();

  const { data, error } = await db.from('solicitacoes')
    .select('id, solicitante, contato, assunto, descricao, setor, prioridade, ' +
            'status, criado_em, tarefa_id, motivo_recusa, avaliado_por')
    .eq('obra_id', _obra.id).order('criado_em', { ascending: false }).limit(100);

  _pedidos = error ? [] : (data || []);
  const pendentes = _pedidos.filter(p => p.status === 'pendente');

  $('bloco-pedidos').hidden = !_pedidos.length;
  $('btn-pedidos').textContent = pendentes.length
    ? 'Pedidos recebidos (' + pendentes.length + ' a responder)'
    : 'Pedidos recebidos (' + _pedidos.length + ', todos respondidos)';

  const area = $('pedidos-lista');
  area.innerHTML = '<div class="lista"></div>';
  const cx = area.firstElementChild;

  _pedidos.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pessoa' + (p.status === 'pendente' ? '' : ' encerrada');
    if (p.status === 'pendente' && p.prioridade === 'alta') b.dataset.nivel = 'grave';
    else if (p.status === 'pendente') b.dataset.nivel = 'atencao';

    const tarja = document.createElement('span'); tarja.className = 'tarja';
    const miolo = document.createElement('span'); miolo.className = 'miolo';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.assunto;
    const sub = document.createElement('span'); sub.className = 'sub';
    sub.textContent = [p.solicitante, p.setor, PRIORIDADE_TF[p.prioridade],
                       dataBR(String(p.criado_em).slice(0, 10))].filter(Boolean).join(' · ');
    miolo.append(nm, sub);

    const lado = document.createElement('span'); lado.className = 'lado';
    const st = document.createElement('span'); st.className = 'chip'; st.dataset.st = p.status;
    st.textContent = { pendente:'A responder', aceita:'Virou tarefa', recusada:'Recusado' }[p.status];
    lado.appendChild(st);

    b.append(tarja, miolo, lado);
    b.addEventListener('click', () => abrirPedido(p));
    cx.appendChild(b);
  });
}

$('btn-pedidos').addEventListener('click', () => {
  const area = $('pedidos-lista');
  area.hidden = !area.hidden;
  $('btn-pedidos').setAttribute('aria-expanded', String(!area.hidden));
});

$('btn-copiar-link').addEventListener('click', async () => {
  const b = $('btn-copiar-link');
  try {
    await navigator.clipboard.writeText(linkDoFormulario());
    b.textContent = 'Link copiado';
  } catch (e) {
    // Sem permissão de área de transferência: o link está na tela para
    // copiar à mão, então não finjo que copiei.
    b.textContent = 'Copie o link acima';
  }
  setTimeout(() => { b.textContent = 'Copiar link'; }, 2200);
});

function abrirPedido(p) {
  _pdEditando = p;
  $('pedido-quem').textContent =
    `${p.solicitante}${p.contato ? ' · ' + p.contato : ''} — ` +
    `enviado em ${dataBR(String(p.criado_em).slice(0, 10))}` +
    (p.status === 'pendente' ? '' :
     p.status === 'aceita' ? ' · já virou tarefa' :
     ' · recusado' + (p.motivo_recusa ? ': ' + p.motivo_recusa : ''));

  $('pd-assunto').value = p.assunto;
  $('pd-descricao').value = p.descricao || '';
  $('pd-responsavel').value = '';
  $('pd-prazo').value = '';
  const pendente = p.status === 'pendente';
  $('btn-aceitar-pedido').hidden = !pendente;
  $('btn-recusar-pedido').hidden = !pendente;
  ['pd-assunto','pd-descricao','pd-responsavel','pd-prazo']
    .forEach(id => { $(id).disabled = !pendente; });
  $('erro-pedido-av').hidden = true;
  $('folha-pedido').hidden = false;
}

$('btn-fechar-pedido').addEventListener('click', () => { $('folha-pedido').hidden = true; });
$('folha-pedido').addEventListener('click', (ev) => {
  if (ev.target === $('folha-pedido')) $('folha-pedido').hidden = true;
});

$('form-pedido-avaliar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = $('erro-pedido-av'); erro.hidden = true;
  if (!_pdEditando) return;

  const assunto = $('pd-assunto').value.trim();
  if (!assunto) return falhar(erro, 'A tarefa precisa de um assunto.');

  const { data: tarefa, error } = await db.from('tarefas').insert({
    obra_id: _obra.id,
    assunto,
    descricao: [$('pd-descricao').value.trim(),
                'Pedido de ' + _pdEditando.solicitante +
                (_pdEditando.contato ? ' (' + _pdEditando.contato + ')' : '')]
               .filter(Boolean).join('\n\n'),
    criador: _pdEditando.solicitante,
    responsavel: $('pd-responsavel').value.trim() || null,
    setor: _pdEditando.setor || null,
    prioridade: _pdEditando.prioridade,
    status: 'aberta',
    data_lancamento: hojeISO(),
    data_termino: $('pd-prazo').value || null,
    origem: 'pauta'
  }).select('id').single();

  if (error) return falhar(erro, 'Não consegui criar a tarefa: ' + error.message);

  const r = await db.from('solicitacoes').update({
    status: 'aceita', tarefa_id: tarefa.id,
    avaliado_por: _perfilNome || null, avaliado_em: new Date().toISOString()
  }).eq('id', _pdEditando.id);

  if (r.error) return falhar(erro,
    'A tarefa foi criada, mas não consegui marcar o pedido como aceito: ' + r.error.message);

  $('folha-pedido').hidden = true;
  await carregarTarefas();
  await carregarPainel();
});

$('btn-recusar-pedido').addEventListener('click', async () => {
  if (!_pdEditando) return;
  const motivo = prompt('Por que está recusando? (aparece no histórico)');
  if (motivo === null) return;
  const { error } = await db.from('solicitacoes').update({
    status: 'recusada', motivo_recusa: motivo.trim() || null,
    avaliado_por: _perfilNome || null, avaliado_em: new Date().toISOString()
  }).eq('id', _pdEditando.id);
  if (error) return falhar($('erro-pedido-av'), 'Não consegui recusar: ' + error.message);
  $('folha-pedido').hidden = true;
  await carregarTarefas();
});
