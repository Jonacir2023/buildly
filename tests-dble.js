/* Dublê do Supabase: PostgREST em memória, só o que o app usa.
   Vale como teste porque as regras que importam (índices únicos,
   listas fechadas, cascata) foram testadas em SQL contra o banco real. */
(function () {
  const B = window.__banco = {
    obras: [{id:'o1',codigo:'TESTE',nome:'Obra Teste',cidade:'Cidade Teste',uf:'PR',ativa:true}],
    funcoes: [
      {id:'f1',nome:'Pedreiro',categoria:'operacional',periodicidade_viagem_dias:90},
      {id:'f2',nome:'Engenheiro',categoria:'tecnica',periodicidade_viagem_dias:30},
      {id:'f3',nome:'Encarregado',categoria:'lideranca',periodicidade_viagem_dias:60}
    ],
    pessoas: [], contratos: [], equipamentos: [], ocorrencias: [],
    tarefas: [], epis: [], epi_entregas: [], nfs: [], nf_itens: [],
    contratos_comerciais: [], contrato_itens: [], medicoes: [], medicao_itens: [],
    reunioes: [], reuniao_participantes: [], reuniao_topicos: [], reuniao_pauta: [],
    documentos: [], mural: [], avisos: [], solicitacoes: [], ajuda_custo: [],
    rdos: [], rdo_presencas: [], rdo_atividades: [], rdo_fotos: [], rdo_equipamentos: [],
    perfis: [{id:'u1',nome:'Jonacir Cazelli',papel:'gestor'}]
  };
  const hoje = () => new Date().toISOString().slice(0,10);
  const mais = (iso,n) => { const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n);
                            return d.toISOString().slice(0,10); };
  const id = (p) => p + Math.random().toString(36).slice(2,9);

  const pessoa  = (i) => B.pessoas.find(x => x.id === i);
  const funcao  = (i) => B.funcoes.find(x => x.id === i);
  const contrato= (i) => B.contratos.find(x => x.id === i);

  function efetivo() {
    return B.contratos.filter(c => !c.desligamento).map(c => {
      const f = funcao(c.funcao_id);
      const aj = B.ajuda_custo.find(a => a.contrato_id === c.id && !a.fim);
      return { contrato_id:c.id, nome:pessoa(c.pessoa_id).nome, matricula:c.matricula,
        cracha:c.cracha, funcao:f.nome, obra:'TESTE', admissao:c.admissao, alojado:c.alojado,
        fim_experiencia_1:mais(c.admissao,45), fim_experiencia_2:mais(c.admissao,90),
        recebe_ajuda_custo: !!aj,
        ajuda_custo_valor: aj ? aj.valor_mensal : null,
        periodicidade_viagem_dias:f.periodicidade_viagem_dias,
        proxima_viagem: aj ? null
          : (c.alojado ? mais(c.data_ultima_viagem||c.admissao, f.periodicidade_viagem_dias) : null),
        regime: aj ? 'ajuda_moradia' : (c.alojado ? 'viagem_familiar' : 'local') };
    });
  }
  function resumoRDO() {
    return B.rdos.map(r => {
      const ps = B.rdo_presencas.filter(p => p.rdo_id===r.id && p.situacao==='presente');
      return { rdo_id:r.id, numero:r.numero, data:r.data, obra:'TESTE',
        efetivo: ps.length,
        homem_hora: ps.length ? ps.reduce((s,p)=>s+Number(p.horas_normais)+Number(p.horas_extras),0) : null,
        total_horas_extras: ps.length ? ps.reduce((s,p)=>s+Number(p.horas_extras),0) : null };
    });
  }
  function disponibilidade() {
    const porPrefixo = {};
    B.rdo_equipamentos.forEach(re => {
      const rdo = B.rdos.find(r => r.id === re.rdo_id); if (!rdo) return;
      const eq  = B.equipamentos.find(e => e.id === re.equipamento_id); if (!eq) return;
      const mes = rdo.data.slice(0,8) + '01';
      const ch  = eq.prefixo + '|' + mes;
      const a = porPrefixo[ch] || (porPrefixo[ch] =
        { prefixo:eq.prefixo, tipo:eq.tipo, obra:'TESTE', mes, horas_operando:0, horas_paradas:0 });
      a.horas_operando += Number(re.horas_operando || 0);
      a.horas_paradas  += Number(re.horas_paradas  || 0);
    });
    return Object.values(porPrefixo).map(a => {
      const t = a.horas_operando + a.horas_paradas;
      return { ...a, disponibilidade_pct: t ? Math.round(1000*a.horas_operando/t)/10 : null };
    });
  }

  const d30 = () => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); };
  function ocorrenciasDaObra() {
    return B.ocorrencias.filter(o =>
      B.contratos.some(c => c.id === o.contrato_id && c.obra_id === 'o1') ||
      B.rdos.some(r => r.id === o.rdo_id && r.obra_id === 'o1'));
  }

  const CHUVA_RX = /(chuva|chuvoso|garoa|chuvisco|temporal|tempestade)/i;
  function rdoDia() {
    return B.rdos.map(r => {
      const ps = B.rdo_presencas.filter(p => p.rdo_id === r.id);
      const so = (sit) => ps.filter(p => p.situacao === sit).length;
      const pres = ps.filter(p => p.situacao === 'presente');
      return { rdo_id:r.id, obra:'TESTE', numero:r.numero, data:r.data,
        clima_manha:r.clima_manha, clima_tarde:r.clima_tarde,
        condicao_trabalho:r.condicao_trabalho, jornada:r.jornada, apontador:r.apontador,
        choveu: CHUVA_RX.test(r.clima_manha||'') || CHUVA_RX.test(r.clima_tarde||''),
        presentes: pres.length, faltas: so('falta'),
        faltas_justificadas: so('falta_justificada'), atestados: so('atestado'),
        ferias: so('ferias'), folgas: so('folga'), efetivo_previsto: ps.length,
        homem_hora: pres.reduce((s,p)=>s+Number(p.horas_normais||0)+Number(p.horas_extras||0),0),
        horas_extras: pres.reduce((s,p)=>s+Number(p.horas_extras||0),0),
        atividades: B.rdo_atividades.filter(a=>a.rdo_id===r.id).length,
        fotos: B.rdo_fotos.filter(f=>f.rdo_id===r.id).length,
        equip_operando: B.rdo_equipamentos.filter(e=>e.rdo_id===r.id)
          .reduce((s,e)=>s+Number(e.horas_operando||0),0),
        equip_paradas: B.rdo_equipamentos.filter(e=>e.rdo_id===r.id)
          .reduce((s,e)=>s+Number(e.horas_paradas||0),0) };
    });
  }

  function statusObra() {
    const ativos = efetivo();
    const rs = B.rdos.slice().sort((a,b)=>a.data<b.data?1:-1);
    return [{ obra_id:'o1', tarefas_abertas:0, tarefas_atrasadas:0,
      ultimo_rdo: rs[0] ? rs[0].data : null,
      dias_sem_rdo: rs[0] ? Math.round((new Date(hoje())-new Date(rs[0].data))/86400000) : null,
      rdos_30_dias: B.rdos.length, efetivo_ativo: ativos.length, equipamentos_ativos:0,
      contratos_ativos: ativos.length, documentos:0, reunioes_30_dias:0,
      ocorrencias_30_dias: ocorrenciasDaObra().filter(o => o.data >= d30()).length }]
      .map(x => ({ ...x,
        tarefas_abertas: B.tarefas.filter(t => ['aberta','em_andamento'].includes(t.status)).length,
        tarefas_atrasadas: B.tarefas.filter(t => ['aberta','em_andamento'].includes(t.status)
          && t.data_termino && t.data_termino < hoje()).length,
        documentos: B.documentos.length,
        reunioes_30_dias: B.reunioes.filter(r => r.data >= d30()).length }))
      .map(x => ({ ...x, equipamentos_ativos: B.equipamentos.filter(e=>e.ativo && e.obra_id==='o1').length }));
  }

  // embutidos: o app pede pessoa:pessoas(...) e funcao:funcoes(...)
  function enriquecer(nome, linha) {
    if (nome === 'contratos') return { ...linha,
      pessoa: pessoa(linha.pessoa_id), funcao: funcao(linha.funcao_id) };
    if (nome === 'rdo_presencas') {
      const c = contrato(linha.contrato_id);
      return { ...linha, contrato: c ? { id:c.id, matricula:c.matricula,
        pessoa: pessoa(c.pessoa_id), funcao: funcao(c.funcao_id) } : null };
    }
    if (nome === 'ocorrencias') {
      const c = B.contratos.find(x => x.id === linha.contrato_id);
      const r = B.rdos.find(x => x.id === linha.rdo_id);
      return { ...linha,
        contrato: c ? { id:c.id, obra_id:c.obra_id, pessoa: pessoa(c.pessoa_id),
                        funcao: funcao(c.funcao_id) } : null,
        rdo: r ? { id:r.id, numero:r.numero, data:r.data, obra_id:r.obra_id } : null };
    }
    if (nome === 'rdo_equipamentos') return { ...linha,
      equipamento: B.equipamentos.find(e => e.id === linha.equipamento_id) };
    return linha;
  }

  function fichaEpi() {
    return B.epi_entregas.map(e => {
      const c = B.contratos.find(x => x.id === e.contrato_id);
      const p = c && pessoa(c.pessoa_id);
      const epi = B.epis.find(x => x.id === e.epi_id);
      return { contrato_id: e.contrato_id, nome: p ? p.nome : '?', obra: 'TESTE',
        epi: epi ? epi.nome : '?', ca: epi ? epi.ca : null,
        data_entrega: e.data_entrega, quantidade: e.quantidade, motivo: e.motivo,
        assinatura_ok: e.assinatura_ok,
        troca_prevista: epi && epi.validade_uso_dias
          ? mais(e.data_entrega, epi.validade_uso_dias) : null };
    });
  }
  function medicaoItem() {
    const saida = [];
    B.contratos_comerciais.forEach(cc => {
      const itens = B.contrato_itens.filter(i => i.contrato_id === cc.id);
      const meds = B.medicoes.filter(m => m.contrato_id === cc.id)
                    .slice().sort((a,b) => a.numero - b.numero);
      itens.forEach(i => {
        let acum = 0;
        meds.forEach(m => {
          const mi = B.medicao_itens.find(x => x.medicao_id === m.id && x.item_id === i.id);
          const atual = Number(mi ? mi.quantidade : 0);
          const anterior = acum;
          acum += atual;
          saida.push({ contrato_id: cc.id, medicao_id: m.id, medicao_numero: m.numero,
            mes_referencia: m.mes_referencia, data_inicio: m.data_inicio, data_fim: m.data_fim,
            item_id: i.id, item: i.item, descricao: i.descricao, unidade: i.unidade,
            qtd_contratada: Number(i.quantidade), valor_unitario: Number(i.valor_unitario),
            qtd_atual: atual, qtd_anterior: anterior, qtd_acumulada: acum,
            qtd_saldo: Number(i.quantidade) - acum,
            valor_atual: Math.round(atual * Number(i.valor_unitario) * 100)/100,
            valor_acumulado: Math.round(acum * Number(i.valor_unitario) * 100)/100 });
        });
      });
    });
    return saida;
  }
  function chuvaMes() {
    const CH = /(chuva|chuvoso|garoa|chuvisco|temporal|tempestade)/i;
    const por = {};
    B.rdos.forEach(r => {
      const mes = r.data.slice(0,8) + '01';
      const a = por[mes] || (por[mes] = { obra:'TESTE', mes, dias_com_rdo:0,
        dias_com_chuva:0, dias_chuva_manha:0, dias_chuva_tarde:0,
        dias_impraticavel:0, dias_parcial:0, dias_praticavel:0, dias_sem_condicao:0 });
      const m = CH.test(r.clima_manha || ''), t = CH.test(r.clima_tarde || '');
      a.dias_com_rdo++;
      if (m || t) a.dias_com_chuva++;
      if (m) a.dias_chuva_manha++;
      if (t) a.dias_chuva_tarde++;
      if (r.condicao_trabalho === 'impraticavel') a.dias_impraticavel++;
      else if (r.condicao_trabalho === 'parcialmente_impraticavel') a.dias_parcial++;
      else if (r.condicao_trabalho === 'praticavel') a.dias_praticavel++;
      else a.dias_sem_condicao++;
    });
    return Object.values(por).map(a => ({ ...a,
      dias_perdidos: Math.round((a.dias_impraticavel + 0.5*a.dias_parcial) * 10)/10 }));
  }

  function contratoSaldo() {
    return B.contratos_comerciais.map(cc => {
      const itens = B.contrato_itens.filter(i => i.contrato_id === cc.id);
      const contratado = itens.reduce((s,i) => s + Number(i.quantidade)*Number(i.valor_unitario), 0);
      const medido = B.medicao_itens.reduce((s, mi) => {
        const i = itens.find(x => x.id === mi.item_id);
        return i ? s + Number(mi.quantidade)*Number(i.valor_unitario) : s;
      }, 0);
      return { contrato_id: cc.id, tipo: cc.tipo, nome: cc.nome, empresa: cc.empresa,
        obra: 'TESTE', valor_contratado: contratado, valor_medido: medido,
        valor_saldo: contratado - medido,
        medicoes_lancadas: B.medicoes.filter(m => m.contrato_id === cc.id).length };
    });
  }

  const VIRTUAIS = { vw_efetivo: efetivo, vw_rdo_resumo: resumoRDO,
                     vw_status_obra: statusObra, vw_alertas: () => [],
                     vw_disponibilidade_equipamento: disponibilidade,
                     vw_ficha_epi: fichaEpi, vw_medicao_item: medicaoItem,
                     vw_contrato_saldo: contratoSaldo, vw_chuva_mes: chuvaMes,
                     vw_rdo_dia: rdoDia };

  function tabela(nome) {
    const cond = [];   // funções de filtro
    let ordem = null, invertida = false, teto = null;

    const cru = () => VIRTUAIS[nome] ? VIRTUAIS[nome]() : (B[nome] || []);
    const ver = () => {
      let d = cru().map(l => enriquecer(nome, l));
      cond.forEach(f => { d = d.filter(f); });
      if (ordem) {
        d = d.slice().sort((a,b) => (a[ordem] > b[ordem] ? 1 : a[ordem] < b[ordem] ? -1 : 0));
        if (invertida) d.reverse();
      }
      return teto == null ? d : d.slice(0, teto);
    };
    const pronto = () => Promise.resolve({ data: ver(), error: null });

    const o = {
      select: () => o,
      eq:  (k,v) => {
        if (k.includes('.')) {
          const [pai, campo] = k.split('.');
          cond.push(r => r[pai] && String(r[pai][campo]) === String(v));
        } else {
          cond.push(r => String(r[k]) === String(v));
        }
        return o;
      },
      lte: (k,v) => { cond.push(r => r[k] <= v); return o; },
      lt:  (k,v) => { cond.push(r => r[k] <  v); return o; },
      gte: (k,v) => { cond.push(r => r[k] >= v); return o; },
      not: (k)   => { cond.push(r => r[k] != null); return o; },
      ilike: (k,v) => { const alvo = String(v).replace(/%/g,'').toLowerCase();
        cond.push(r => String(r[k]||'').toLowerCase().includes(alvo)); return o; },
      is:  (k,v) => { cond.push(r => (v === null ? r[k] == null : r[k] === v)); return o; },
      or:  (expr)=> {
        const partes = expr.split(',');
        cond.push(r => partes.some(p => {
          const i1 = p.indexOf('.'), i2 = p.indexOf('.', i1+1);
          const campo = p.slice(0, i1), op = p.slice(i1+1, i2), val = p.slice(i2+1);
          if (op === 'is') return r[campo] == null;
          if (op === 'gte') return r[campo] != null && r[campo] >= val;
          if (op === 'ilike') return String(r[campo]||'').toLowerCase()
            .includes(val.replace(/\*/g,'').toLowerCase());
          return false;
        }));
        return o;
      },
      order: (k, op) => { ordem = k; invertida = op && op.ascending === false; return o; },
      limit: (n) => { teto = n; return o; },
      maybeSingle: () => Promise.resolve({ data: ver()[0] || null, error: null }),
      single: () => { const d = ver()[0];
        return Promise.resolve(d ? {data:d,error:null} : {data:null,error:{message:'no rows'}}); },
      then: (f) => pronto().then(f),

      _recalcNF: null,
      insert: (linha) => {
        const linhas = Array.isArray(linha) ? linha : [linha];
        for (const l of linhas) {
          aplicarPadroes(nome, l);
          const e = choque(nome, l);
          if (e) return respostaErro(e);
        }
        const criadas = linhas.map(l => { const n = { id:id(nome[0]), ...l }; B[nome].push(n); return n; });
        if (nome === 'nf_itens') recalcularNF(criadas[0].nf_id);
        if (nome === 'tarefas') carimbarTarefa(criadas[0], null);
        const res = { data: criadas[0], error: null };
        return { select: () => ({ single: () => Promise.resolve(res) }),
                 then: (f) => Promise.resolve(res).then(f) };
      },
      update: (mud) => ({ eq: (k,v) => {
        const erros = [];
        (B[nome]||[]).filter(r => String(r[k])===String(v)).forEach(r => {
          const antes = { ...r };
          const e = choque(nome, { ...r, ...mud }, r.id);
          if (e) { erros.push(e); return; }
          Object.assign(r, mud);
          if (nome === 'nf_itens') recalcularNF(r.nf_id);
          if (nome === 'tarefas') carimbarTarefa(r, antes);
        });
        return Promise.resolve({ error: erros.length ? { message: erros[0] } : null });
      }}),
      delete: () => ({ eq: (k,v) => {
        const indo = (B[nome]||[]).filter(r => String(r[k]) === String(v));
        B[nome] = (B[nome]||[]).filter(r => String(r[k]) !== String(v));
        if (nome === 'nf_itens') indo.forEach(r => recalcularNF(r.nf_id));
        if (nome === 'rdos') ['rdo_presencas','rdo_atividades','rdo_fotos','rdo_equipamentos']
          .forEach(t => { B[t] = B[t].filter(r => String(r.rdo_id) !== String(v)); });
        return Promise.resolve({ error: null });
      }})
    };
    return o;
  }

  function recalcularNF(nfId) {
    const nf = B.nfs.find(n => n.id === nfId); if (!nf) return;
    nf.total = B.nf_itens.filter(i => i.nf_id === nfId)
      .reduce((s,i) => s + Math.round(Number(i.quantidade)*Number(i.preco_unitario)*100)/100, 0);
  }
  function carimbarTarefa(t, antes) {
    if (t.status === 'concluida' && (!antes || antes.status !== 'concluida'))
      t.concluido_em = new Date().toISOString();
    else if (t.status !== 'concluida') t.concluido_em = null;
  }

  function respostaErro(message) {
    const r = { data:null, error:{ message } };
    return { select: () => ({ single: () => Promise.resolve(r) }),
             then: (f) => Promise.resolve(r).then(f) };
  }

  // valores padrão de coluna, que o Postgres aplica e o dublê também
  // precisa aplicar — senão o teste vê "undefined" onde o banco põe valor
  const PADROES = {
    solicitacoes: { status: 'pendente', prioridade: 'media' },
    avisos:       { gravidade: 'atencao' },
    tarefas:      { status: 'aberta', prioridade: 'media', origem: 'pauta' },
    contratos:    { alojado: false },
    equipamentos: { categoria: 'pesado', propriedade: 'proprio', ativo: true },
    epi_entregas: { quantidade: 1, motivo: 'primeira_entrega', assinatura_ok: false },
    rdo_presencas:{ situacao: 'presente', horas_normais: 8, horas_extras: 0 },
    medicoes:     { fechada: false },
    documentos:   { categoria: 'Outros' },
    nfs:          { total: 0 }
  };
  function aplicarPadroes(nome, l) {
    const p = PADROES[nome]; if (!p) return l;
    Object.keys(p).forEach(k => { if (l[k] === undefined) l[k] = p[k]; });
    return l;
  }

  // os mesmos índices e checagens que o Postgres tem
  function choque(nome, l, ignorarId) {
    const outros = (B[nome]||[]).filter(r => !ignorarId || r.id !== ignorarId);
    if (nome === 'nf_itens') l.total_item = Math.round(Number(l.quantidade)*Number(l.preco_unitario)*100)/100;
    if (nome === 'contrato_itens') l.valor_total = Math.round(Number(l.quantidade)*Number(l.valor_unitario)*100)/100;
    if (nome === 'tarefas' && !['aberta','em_andamento','concluida','cancelada'].includes(l.status))
      return 'new row violates check constraint "tarefas_status_check"';
    if (nome === 'epi_entregas' && !(Number(l.quantidade) > 0))
      return 'new row violates check constraint "epi_entregas_quantidade_check"';
    if (nome === 'nfs' && outros.some(n =>
        n.numero === l.numero && (n.serie||null) === (l.serie||null) && n.fornecedor === l.fornecedor))
      return 'duplicate key value violates unique constraint "uq_nf"';
    if (nome === 'nf_itens' && outros.some(i => i.nf_id === l.nf_id && i.seq === l.seq))
      return 'duplicate key value violates unique constraint "uq_nf_item"';
    if (nome === 'medicoes' && outros.some(m => m.contrato_id === l.contrato_id && m.numero === l.numero))
      return 'duplicate key value violates unique constraint "medicoes_contrato_id_numero_key"';
    if (nome === 'medicao_itens' && outros.some(m => m.medicao_id === l.medicao_id && m.item_id === l.item_id))
      return 'duplicate key value violates unique constraint "medicao_itens_medicao_id_item_id_key"';
    if (nome === 'reunioes' && l.hora_inicio && l.hora_fim && l.hora_fim < l.hora_inicio)
      return 'new row violates check constraint "reunioes_check"';
    if (nome === 'reuniao_participantes' && outros.some(p => p.reuniao_id === l.reuniao_id && p.nome === l.nome))
      return 'duplicate key value violates unique constraint "reuniao_participantes_reuniao_id_nome_key"';
    if (nome === 'documentos') {
      if (!['Contrato','Cronograma','Programação Semanal','Orçamento','Outros'].includes(l.categoria))
        return 'new row violates check constraint "documentos_categoria_check"';
      if (!String(l.url || '').trim())
        return 'new row violates check constraint "documentos_url_check"';
    }
    if (nome==='pessoas' && l.cpf && outros.some(p=>p.cpf===l.cpf))
      return 'duplicate key value violates unique constraint "pessoas_cpf_key"';
    if (nome==='contratos' && outros.some(c=>c.pessoa_id===l.pessoa_id && !c.desligamento))
      return 'duplicate key value violates unique constraint "uq_contrato_ativo"';
    if (nome==='equipamentos' && outros.some(e=>e.prefixo===l.prefixo))
      return 'duplicate key value violates unique constraint "equipamentos_prefixo_key"';
    if (nome==='rdos') {
      if (outros.some(r=>r.obra_id===l.obra_id && r.data===l.data))
        return 'duplicate key value violates unique constraint "uq_rdo_obra_data"';
      if (outros.some(r=>r.obra_id===l.obra_id && r.numero===l.numero))
        return 'duplicate key value violates unique constraint "uq_rdo_obra_numero"';
    }
    if (nome==='rdo_presencas' && outros.some(p=>p.rdo_id===l.rdo_id && p.contrato_id===l.contrato_id))
      return 'duplicate key value violates unique constraint "uq_presenca"';
    if (nome==='rdo_equipamentos' && outros.some(x=>x.rdo_id===l.rdo_id && x.equipamento_id===l.equipamento_id))
      return 'duplicate key value violates unique constraint "uq_rdo_equip"';
    if (nome==='ajuda_custo') {
      if (!l.fim && outros.some(a => a.contrato_id === l.contrato_id && !a.fim))
        return 'duplicate key value violates unique constraint "uq_ajuda_ativa"';
      if (l.fim && l.fim < l.inicio)
        return 'new row violates check constraint "chk_periodo"';
    }
    if (nome==='ocorrencias') {
      if (l.contrato_id == null && l.rdo_id == null)
        return 'new row violates check constraint "chk_ocorrencia_vinculo"';
      const TIPOS=['advertencia_verbal','advertencia_escrita','suspensao','quase_acidente',
                   'acidente_sem_afastamento','acidente_com_afastamento','desvio_comportamental','elogio'];
      if (!TIPOS.includes(l.tipo))
        return 'new row violates check constraint "ocorrencias_tipo_check"';
      if (l.gravidade != null && !['baixa','media','alta','critica'].includes(l.gravidade))
        return 'new row violates check constraint "ocorrencias_gravidade_check"';
    }
    if (nome==='rdo_atividades' && l.percentual_executado != null &&
        (l.percentual_executado < 0 || l.percentual_executado > 100))
      return 'new row violates check constraint "rdo_atividades_percentual_executado_check"';
    return null;
  }

  window.supabase = { createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data:{ session:{} } }),
      getUser:    () => Promise.resolve({ data:{ user:{ id:'u1', email:'jonacir70@icloud.com' } } }),
      signOut:    () => Promise.resolve({})
    },
    from: tabela
  })};
})();
