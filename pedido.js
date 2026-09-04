/* ============================================================
   FORMULÁRIO PÚBLICO DE PEDIDO
   Quem preenche não tem login. A página só INSERE: as políticas
   do banco não deixam ela ler nem alterar nada. E o pedido não
   vira tarefa sozinho — entra numa caixa de entrada e alguém da
   obra decide. Formulário aberto gravando direto na tabela de
   verdade é porta aberta.

   O endereço precisa dizer de qual obra é o pedido:
   .../pedido.html?obra=TESTE
   ============================================================ */

const SUPABASE_URL = 'https://ynmewxemcntafwoipybm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_53Hk4J6SwBA7yoXcMRV2Mw_Uj5ifQUv';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const obra = (new URLSearchParams(location.search).get('obra') || '').trim().toUpperCase();

if (!obra) {
  $('alvo').textContent =
    'Este endereço está incompleto: falta dizer para qual obra é o pedido. ' +
    'Peça o link certo a quem te mandou — ele termina com ?obra=CÓDIGO.';
  $('form-pedido').hidden = true;
} else {
  $('alvo').innerHTML = '';
  $('alvo').append(
    document.createTextNode('Pedido para a obra '),
    Object.assign(document.createElement('span'), { className: 'obra-alvo', textContent: obra }),
    document.createTextNode('. Preencha e envie — não precisa de senha.'));
}

function falhar(msg) {
  const e = $('erro-pedido');
  e.textContent = msg;
  e.hidden = false;
}

$('form-pedido').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('erro-pedido').hidden = true;

  // Isca invisível: se veio preenchido, foi robô. Respondo como se
  // tivesse dado certo — discutir com robô não leva a nada.
  if ($('s-isca').value) { mostrarPronto(); return; }

  const nome = $('s-nome').value.trim();
  const assunto = $('s-assunto').value.trim();
  if (nome.length < 2)    return falhar('Escreva seu nome completo.');
  if (assunto.length < 3) return falhar('Diga o que você precisa, em poucas palavras.');

  const botao = $('btn-enviar');
  botao.disabled = true; botao.textContent = 'Enviando…';

  // Sem .select() de propósito: pedir retorno exigiria permissão de
  // leitura, e esta página não tem — nem deve ter.
  const { error } = await db.from('solicitacoes').insert({
    obra_codigo: obra,
    solicitante: nome,
    contato:     $('s-contato').value.trim() || null,
    assunto,
    descricao:   $('s-descricao').value.trim() || null,
    setor:       $('s-setor').value || null,
    prioridade:  $('s-prioridade').value
  });

  botao.disabled = false; botao.textContent = 'Enviar pedido';

  if (error) {
    return falhar(/não encontrada|foreign key/i.test(error.message)
      ? `A obra ${obra} não foi encontrada. Confira o link com quem te mandou.`
      : 'Não consegui enviar. Verifique a conexão e tente de novo.');
  }
  mostrarPronto();
});

function mostrarPronto() {
  $('form-pedido').hidden = true;
  $('pronto').hidden = false;
  window.scrollTo(0, 0);
}

$('btn-outro').addEventListener('click', () => {
  $('form-pedido').reset();
  $('s-prioridade').value = 'media';
  $('form-pedido').hidden = false;
  $('pronto').hidden = true;
  $('s-nome').focus();
});
