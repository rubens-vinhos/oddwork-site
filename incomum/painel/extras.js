/* Painel Incomum — Repor (stock baixo em tempo real), Cupões (criar/editar/apagar) e Mais vendidos / Peças paradas.
   Usa sb, S, $, $$, esc, eur, data, toast, szOrd, fechar de painel.js e C, carregarProds, carregarCats, editar, euros, centimos, final de catalogo.js. */
const X = { filtroRepor: '', periodo: 30, origem: '', cupoes: [], usos: {} };
const lerLim = () => { try { const n = parseInt(localStorage.getItem('incomum-repor-lim'), 10); return Number.isInteger(n) && n >= 0 ? n : 1; } catch { return 1; } };
const diasDesde = d => d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null;

/* =================== REPOR =================== */
// "Para repor já": tamanhos que já venderam (loja ou online) e estão no limite, e produtos novos sem stock.
// O resto (tamanhos que nunca tiveram stock na loja) fica numa lista escondida. Vem de C.prods: produtos novos entram logo, apagados saem.
async function carregarVendasVar() {
  const [ro, rl] = await Promise.all([
    sb.from('incomum_encomendas').select('pago_em, criado, itens:incomum_itens(variante_id, qtd)').in('estado', PAGAS).order('criado', { ascending: false }).limit(3000),
    sb.from('incomum_vendas_loja').select('criado, itens').eq('anulada', false).order('criado', { ascending: false }).limit(3000),
  ]);
  const m = {};
  const add = (id, d, q) => { if (!id) return; const x = m[id] || (m[id] = { q: 0, d: 0 }); x.q += q || 1; x.d = Math.max(x.d, +new Date(d)); };
  for (const e of ro.data || []) for (const i of e.itens || []) add(i.variante_id, e.pago_em || e.criado, i.qtd);
  for (const v of rl.data || []) for (const i of v.itens || []) add(i.variante, v.criado, i.qtd);
  X.vv = m;
}
// produto "novo" = criado depois da importação inicial do catálogo e há 14 dias ou menos
function eNovo(p) {
  if (!p.criado) return false;
  if (X.importado === undefined) X.importado = Math.min(...C.prods.map(x => +new Date(x.criado || Date.now())));
  const t = +new Date(p.criado);
  return t > X.importado + 3600e3 && Date.now() - t <= 14 * 864e5;
}
function aRepor() {
  const lim = lerLim(), vv = X.vv || {}, ja = [], outras = [];
  for (const p of C.prods) {
    if (!p.ativo) continue;
    const novo = eNovo(p), baixo = p.variantes.filter(v => v.ativo && v.stock <= lim);
    const urg = baixo.filter(v => vv[v.id] || novo), resto = baixo.filter(v => !(vv[v.id] || novo));
    const ord = (a, b) => a.stock - b.stock || String(a.cor).localeCompare(b.cor) || szOrd(a.tam, b.tam);
    if (urg.length) ja.push({ p, vs: urg.sort(ord), esg: urg.filter(v => v.stock <= 0).length, novo, ult: Math.max(0, ...urg.map(v => (vv[v.id] || {}).d || 0)) });
    if (resto.length) outras.push({ p, vs: resto.sort(ord), esg: resto.filter(v => v.stock <= 0).length, novo: false });
  }
  ja.sort((a, b) => b.ult - a.ult || b.esg - a.esg || a.p.nome.localeCompare(b.p.nome, 'pt'));
  outras.sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'pt'));
  return { ja, outras };
}
function badgeRepor() {
  if (!X.vv) return;
  const n = aRepor().ja.reduce((a, x) => a + x.esg, 0);
  const b = $('#nRepor'); if (b) { b.hidden = !n; b.textContent = n; }
}
async function carregarRepor() {
  if (!C.prods.length || !X.vv) $('#view').innerHTML = '<div class="empty">A carregar o stock…</div>';
  await Promise.all([carregarProds(), carregarVendasVar()]);
  badgeRepor();
  if (S.v === 'repor') reporView();
}
function reporCard({ p, vs, novo }, vv) {
  const fotoV = v => S.fotoVar[v.id] || S.fotos[p.id] || '';
  return `<article class="rcard">
    <div class="rc-h"><img src="${S.fotos[p.id] || ''}" alt="" loading="lazy"><div><b>${esc(p.nome)}</b>${novo ? '<span class="rnovo">Novo</span>' : ''}<small>${vs.length} ${vs.length === 1 ? 'tamanho' : 'tamanhos'}</small></div>
      <button class="ghost sm" data-rp="${p.id}">Abrir</button></div>
    ${vs.map(v => { const s = vv && vv[v.id]; return `<div class="rv ${v.stock <= 0 ? 'z' : ''}"><img src="${fotoV(v)}" alt=""><span class="rv-n">${esc([v.cor, v.tam].filter(Boolean).join(' · ') || 'Único')}${s ? `<small>vendeu ${s.q} · última ${data(new Date(s.d))}</small>` : ''}</span>
      <span class="rv-s">${v.stock <= 0 ? 'Esgotado' : v.stock === 1 ? 'Última' : 'Só ' + v.stock}</span>
      <div class="st"><button data-rs="${v.id}" data-d="-1" aria-label="Menos">−</button><input value="${v.stock}" data-rsi="${v.id}" inputmode="numeric"><button data-rs="${v.id}" data-d="1" aria-label="Mais">+</button></div></div>`; }).join('')}
  </article>`;
}
function reporView() {
  const lim = lerLim(), { ja, outras } = aRepor(), vv = X.vv || {};
  const esgV = ja.reduce((a, x) => a + x.esg, 0), acabV = ja.reduce((a, x) => a + x.vs.length - x.esg, 0), novos = ja.filter(x => x.novo).length;
  const nOutras = outras.reduce((a, x) => a + x.vs.length, 0);
  $('#view').innerHTML = `
  <div class="kpis k3">
    <div class="kpi ${esgV ? 'kbad' : ''}"><small>Vendeu e esgotou</small><b>${esgV}</b></div>
    <div class="kpi ${acabV ? 'kwarn' : ''}"><small>Vendeu e está a acabar</small><b>${acabV}</b></div>
    <div class="kpi"><small>Produtos novos sem stock</small><b>${novos}</b></div>
  </div>
  <div class="bar"><p class="hint" style="margin:0;flex:1">Atualiza sozinha com cada venda e cada mudança de stock. Quando chegar mercadoria, carrega em <b>+</b>: fica guardado logo e sai desta lista.</p>
    <label class="rlim">Avisar com <select id="rLim">${[0, 1, 2, 3, 5].map(n => `<option value="${n}" ${n === lim ? 'selected' : ''}>${n === 0 ? 'só esgotadas' : n + ' ou menos'}</option>`).join('')}</select></label></div>
  <h3 class="rtit">🔴 Para repor já</h3>
  ${ja.length ? `<div class="rgrid">${ja.map(x => reporCard(x, vv)).join('')}</div>` : '<div class="card"><div class="empty">Nada para repor. 🎉</div></div>'}
  ${nOutras ? `<button class="ghost rmais" id="rOutras">${X.verOutras ? 'Esconder' : 'Mostrar'} outros ${nOutras} tamanhos sem stock (nunca venderam)</button>
    ${X.verOutras ? `<div class="rgrid">${outras.map(x => reporCard(x, null)).join('')}</div>` : ''}` : ''}`;
  $('#rLim').onchange = e => { try { localStorage.setItem('incomum-repor-lim', e.target.value); } catch {} reporView(); badgeRepor(); };
  if ($('#rOutras')) $('#rOutras').onclick = () => { X.verOutras = !X.verOutras; reporView(); };
  $$('[data-rp]').forEach(b => b.onclick = () => abrirProduto(b.dataset.rp));
  const achar = id => { for (const p of C.prods) { const v = p.variantes.find(x => x.id === id); if (v) return v; } return null; };
  $$('[data-rs]').forEach(b => b.onclick = () => { const v = achar(b.dataset.rs); if (v) gravarStock(v, Math.max(0, v.stock + +b.dataset.d), b.closest('.st')); });
  $$('[data-rsi]').forEach(i => i.onchange = () => { const v = achar(i.dataset.rsi), n = Math.max(0, Math.round(+i.value || 0)); if (v) gravarStock(v, n, i.closest('.st')); });
}
async function gravarStock(v, n, el) {
  const antes = v.stock; v.stock = n;
  if (el) { el.querySelector('input').value = n; }
  const { error } = await sb.from('incomum_variantes').update({ stock: n, atualizado: new Date().toISOString() }).eq('id', v.id);
  if (error) { v.stock = antes; if (el) el.querySelector('input').value = antes; return toast('Não foi possível guardar o stock'); }
  toast(`Stock guardado: ${n}`);
  badgeRepor();
  clearTimeout(gravarStock.t); gravarStock.t = setTimeout(() => { if (S.v === 'repor') reporView(); }, 1500);
}
async function abrirProduto(id) {
  S.v = 'produtos'; history.replaceState(null, '', '#produtos');
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === 'produtos'));
  marcarMais();
  await carregarCats(); if (!C.prods.length) await carregarProds();
  editar(id); scrollTo(0, 0);
}

/* =================== CUPÕES =================== */
const normCod = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function estadoCupao(c) {
  const agora = Date.now(), u = X.usos[c.codigo] || 0;
  if (!c.ativo) return ['off', 'Desligado'];
  if (c.inicio && new Date(c.inicio) > agora) return ['agenda', 'Agendado'];
  if (c.fim && new Date(c.fim) < agora) return ['off', 'Acabou'];
  if (c.max_usos && u >= c.max_usos) return ['off', 'Esgotado'];
  return ['on', 'Ativo'];
}
const oQueDa = c => [c.pct ? `-${c.pct}% em tudo` : '', c.portes_gratis ? 'Envio grátis' : ''].filter(Boolean).join(' + ');
async function carregarCupoes() {
  $('#view').innerHTML = '<div class="empty">A carregar os cupões…</div>';
  const [rc, re] = await Promise.all([
    sb.from('incomum_cupoes').select('*').order('criado', { ascending: false }),
    sb.from('incomum_encomendas').select('cupao, estado').not('cupao', 'is', null).limit(5000),
  ]);
  if (rc.error) return ($('#view').innerHTML = '<div class="card"><div class="empty">Não foi possível carregar os cupões.</div></div>');
  X.cupoes = rc.data; X.usos = {};
  for (const e of re.data || []) if (PAGAS.includes(e.estado)) X.usos[e.cupao] = (X.usos[e.cupao] || 0) + 1;
  if (S.v === 'cupoes') cupoesView();
}
function cupoesView() {
  const L = X.cupoes;
  $('#view').innerHTML = `
  <div class="bar"><button class="btn grad" id="novoCup">+ Novo cupão</button><p class="hint" style="margin:0">O cliente escreve o código no saco de compras. Maiúsculas e "!" não contam: FIGO! = figo.</p></div>
  ${L.length ? `<div class="cgrid">${L.map(c => {
    const [k, t] = estadoCupao(c), u = X.usos[c.codigo] || 0;
    return `<article class="ccard ${k}">
      <div class="cc-top"><span class="cc-cod">${esc(c.nome)}</span><span class="cc-st ${k}">${t}</span></div>
      <div class="cc-da">${esc(oQueDa(c))}</div>
      <ul class="cc-info">
        <li>📅 ${c.inicio && new Date(c.inicio) > Date.now() ? `Começa ${data(c.inicio)} · ` : ''}${c.fim ? `Acaba ${data(c.fim)}` : 'Sem data de fim'}</li>
        <li>🧾 Usado ${u} ${u === 1 ? 'vez' : 'vezes'}${c.max_usos ? ` de ${c.max_usos}` : ''}</li>
        ${c.minimo ? `<li>🛒 Compra mínima ${eur(c.minimo)}</li>` : ''}
      </ul>
      <div class="cc-acts"><label class="sw"><input type="checkbox" data-cl="${esc(c.codigo)}" ${c.ativo ? 'checked' : ''}><span></span>Ligado</label>
        <button class="ghost sm" data-ce="${esc(c.codigo)}">✏️ Editar</button><button class="ghost sm" data-cd="${esc(c.codigo)}">Apagar</button></div>
    </article>`;
  }).join('')}</div>` : '<div class="card"><div class="empty">Ainda não há cupões. Carrega em <b>+ Novo cupão</b>.</div></div>'}`;
  $('#novoCup').onclick = () => formCupao(null);
  $$('[data-ce]').forEach(b => b.onclick = () => formCupao(X.cupoes.find(c => c.codigo === b.dataset.ce)));
  $$('[data-cl]').forEach(i => i.onchange = async () => {
    const { error } = await sb.from('incomum_cupoes').update({ ativo: i.checked }).eq('codigo', i.dataset.cl);
    if (error) { i.checked = !i.checked; return toast('Não foi possível mudar'); }
    X.cupoes.find(c => c.codigo === i.dataset.cl).ativo = i.checked; toast(i.checked ? 'Cupão ligado' : 'Cupão desligado'); cupoesView();
  });
  $$('[data-cd]').forEach(b => b.onclick = async () => {
    const c = X.cupoes.find(x => x.codigo === b.dataset.cd);
    if (!confirm(`Apagar o cupão ${c.nome}? Os clientes deixam de o poder usar.`)) return;
    const { error } = await sb.from('incomum_cupoes').delete().eq('codigo', c.codigo);
    if (error) return toast('Não foi possível apagar');
    toast('Cupão apagado'); carregarCupoes();
  });
}
// datetime-local <-> ISO (hora de Portugal do aparelho)
const paraLocal = iso => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const deLocal = v => (v ? new Date(v).toISOString() : null);
function formCupao(c) {
  const novo = !c; c = c || { nome: '', portes_gratis: false, pct: 0, minimo: null, inicio: null, fim: null, max_usos: null, ativo: true };
  $('#dbox').innerHTML = `<div class="dh"><h2>${novo ? 'Novo cupão' : 'Editar cupão'}</h2><button class="x" data-x aria-label="Fechar">✕</button></div>
  <form class="cform" id="cForm">
    <label>Código que o cliente escreve<input name="nome" required maxlength="30" value="${esc(c.nome)}" placeholder="Ex.: VERAO10" autocapitalize="characters" autocomplete="off"></label>
    <fieldset><legend>O que dá</legend>
      <label class="sw"><input type="checkbox" name="portes" ${c.portes_gratis ? 'checked' : ''}><span></span>Envio grátis</label>
      <label class="cf-pct">Desconto em tudo<span><input name="pct" inputmode="numeric" value="${c.pct || ''}" placeholder="0"> %</span></label>
    </fieldset>
    <fieldset><legend>Quanto tempo fica ativo</legend>
      <label>Começa<input type="datetime-local" name="inicio" value="${paraLocal(c.inicio)}"><small>Vazio = começa já</small></label>
      <label>Acaba<input type="datetime-local" name="fim" value="${paraLocal(c.fim)}"></label>
      <div class="cf-rap">${[[1, '1 dia'], [3, '3 dias'], [7, '1 semana'], [30, '1 mês'], [0, 'Sem fim']].map(([d, t]) => `<button type="button" class="chip" data-dias="${d}">${t}</button>`).join('')}</div>
    </fieldset>
    <fieldset><legend>Limites (opcional)</legend>
      <label>Compra mínima (€)<input name="minimo" inputmode="decimal" value="${c.minimo ? euros(c.minimo) : ''}" placeholder="Sem mínimo"></label>
      <label>Quantas vezes pode ser usado<input name="max" inputmode="numeric" value="${c.max_usos || ''}" placeholder="Sem limite"></label>
    </fieldset>
    <label class="sw"><input type="checkbox" name="ativo" ${c.ativo ? 'checked' : ''}><span></span>Ligado</label>
    <p class="err" id="cErr" hidden></p>
    <button class="btn grad block" id="cOk">${novo ? 'Criar cupão' : 'Guardar'}</button>
  </form>`;
  $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
  $$('#dbox [data-x]').forEach(b => b.onclick = fechar);
  const F = $('#cForm');
  $$('#dbox [data-dias]').forEach(b => b.onclick = () => {
    const d = +b.dataset.dias;
    if (!d) { F.fim.value = ''; return; }
    const base = F.inicio.value ? new Date(F.inicio.value) : new Date();
    const fim = new Date(base.getTime() + d * 864e5); fim.setHours(23, 59, 0, 0);
    F.fim.value = paraLocal(fim.toISOString());
  });
  F.onsubmit = async ev => {
    ev.preventDefault();
    const err = t => { $('#cErr').textContent = t; $('#cErr').hidden = false; };
    const nome = F.nome.value.trim().toUpperCase(), codigo = normCod(nome);
    const pct = F.pct.value.trim() ? Math.round(+F.pct.value.replace(',', '.')) : 0;
    const minimo = F.minimo.value.trim() ? centimos(F.minimo.value) : null;
    const max = F.max.value.trim() ? Math.round(+F.max.value) : null;
    if (codigo.length < 2) return err('O código precisa de pelo menos 2 letras ou números.');
    if (!Number.isInteger(pct) || pct < 0 || pct > 90) return err('O desconto tem de ser entre 0 e 90 %.');
    if (!F.portes.checked && !pct) return err('Escolhe envio grátis, um desconto ou os dois.');
    if (minimo !== null && !(minimo >= 0)) return err('Compra mínima inválida.');
    if (max !== null && !(max > 0)) return err('O limite de usos tem de ser 1 ou mais.');
    const inicio = deLocal(F.inicio.value), fim = deLocal(F.fim.value);
    if (inicio && fim && new Date(fim) <= new Date(inicio)) return err('A data de fim tem de ser depois do início.');
    if (X.cupoes.some(x => x.codigo === codigo && (novo || x.codigo !== c.codigo))) return err('Já existe um cupão com este código.');
    const row = { codigo, nome, portes_gratis: F.portes.checked, pct, minimo, inicio, fim, max_usos: max, ativo: F.ativo.checked };
    $('#cOk').disabled = true;
    const { error } = novo ? await sb.from('incomum_cupoes').insert(row) : await sb.from('incomum_cupoes').update(row).eq('codigo', c.codigo);
    $('#cOk').disabled = false;
    if (error) { console.error(error); return err('Não foi possível guardar. ' + (error.message || '')); }
    fechar(); toast(novo ? `Cupão ${nome} criado` : 'Cupão guardado'); carregarCupoes();
  };
}

/* =================== MAIS VENDIDOS / PEÇAS PARADAS =================== */
async function carregarAnalise() {
  $('#view').innerHTML = '<div class="empty">A juntar as vendas…</div>';
  const [, ro, rl] = await Promise.all([
    C.prods.length ? null : carregarProds(),
    sb.from('incomum_encomendas').select('estado, pago_em, criado, itens:incomum_itens(variante_id, produto, cor, tam, qtd, preco)').in('estado', PAGAS).order('criado', { ascending: false }).limit(3000),
    sb.from('incomum_vendas_loja').select('criado, itens, anulada').eq('anulada', false).order('criado', { ascending: false }).limit(3000),
  ]);
  X.vendas = [];
  for (const e of ro.data || []) for (const i of e.itens || []) X.vendas.push({ o: 'online', d: e.pago_em || e.criado, v: i.variante_id, nome: i.produto, cor: i.cor, tam: i.tam, q: i.qtd, pr: i.preco });
  for (const s of rl.data || []) for (const i of s.itens || []) X.vendas.push({ o: 'loja', d: s.criado, v: i.variante, nome: i.produto, cor: i.cor, tam: i.tam, q: i.qtd, pr: i.preco });
  if (S.v === 'analise') analiseView();
}
function analiseView() {
  const per = X.periodo, desde = per ? Date.now() - per * 864e5 : 0;
  const prodDe = {}; for (const p of C.prods) for (const v of p.variantes) prodDe[v.id] = p;
  const V = X.vendas.filter(x => (!X.origem || x.o === X.origem) && new Date(x.d) >= desde);
  const ag = {};
  for (const x of V) {
    const p = prodDe[x.v], k = p ? p.id : 'n:' + x.nome;
    const a = ag[k] || (ag[k] = { p, nome: p ? p.nome : x.nome, q: 0, r: 0, comb: {} });
    a.q += x.q; a.r += x.q * x.pr;
    const ck = [x.cor, x.tam].filter(Boolean).join(' · ') || 'Único'; a.comb[ck] = (a.comb[ck] || 0) + x.q;
  }
  const top = Object.values(ag).sort((a, b) => b.q - a.q || b.r - a.r).slice(0, 20);
  const vendidos = new Set(Object.keys(ag));
  const parados = C.prods.filter(p => p.ativo && !vendidos.has(p.id)).map(p => {
    const st = p.variantes.filter(v => v.ativo).reduce((a, v) => a + Math.max(0, v.stock), 0);
    const val = p.variantes.filter(v => v.ativo).reduce((a, v) => a + Math.max(0, v.stock) * final(v), 0);
    return { p, st, val, idade: eNovo(p) ? diasDesde(p.criado) : null };
  }).filter(x => x.st > 0).sort((a, b) => (per && (a.idade ?? 999) < per) - (per && (b.idade ?? 999) < per) || b.val - a.val);
  const pecas = V.reduce((a, x) => a + x.q, 0), fat = V.reduce((a, x) => a + x.q * x.pr, 0);
  const valParado = parados.reduce((a, x) => a + x.val, 0);
  const medalha = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  const perTxt = per ? `nos últimos ${per} dias` : 'desde sempre';
  $('#view').innerHTML = `
  <div class="bar">
    <div class="chips">${[[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [0, 'Sempre']].map(([d, t]) => `<button class="chip ${per === d ? 'on' : ''}" data-per="${d}">${t}</button>`).join('')}</div>
    <div class="chips">${[['', 'Loja + online'], ['loja', 'Só loja'], ['online', 'Só online']].map(([o, t]) => `<button class="chip ${X.origem === o ? 'on' : ''}" data-ori="${o}">${t}</button>`).join('')}</div>
  </div>
  <div class="kpis k3">
    <div class="kpi"><small>Peças vendidas</small><b>${pecas}</b></div>
    <div class="kpi"><small>Faturado</small><b>${eur(fat)}</b></div>
    <div class="kpi ${parados.length ? 'kwarn' : ''}"><small>Peças paradas</small><b>${parados.length}</b></div>
  </div>
  <section class="card ed-sec"><h3>🏆 Mais vendidos <small class="muted">${perTxt}</small></h3>
    ${top.length ? `<div class="tlist">${top.map((a, i) => {
      const comb = Object.entries(a.comb).sort((x, y) => y[1] - x[1])[0];
      return `<div class="trow" ${a.p ? `data-ap="${a.p.id}"` : ''}><span class="tr-n">${medalha(i)}</span><img src="${a.p ? S.fotos[a.p.id] || '' : ''}" alt="" loading="lazy">
        <div class="tr-i"><b>${esc(a.nome)}</b><small>Mais saído: ${esc(comb[0])} (${comb[1]})</small></div>
        <div class="tr-r"><b>${a.q} ${a.q === 1 ? 'peça' : 'peças'}</b><small>${eur(a.r)}</small></div></div>`;
    }).join('')}</div>` : '<div class="empty">Ainda não há vendas neste período.</div>'}
  </section>
  <section class="card ed-sec"><h3>💤 Peças paradas <small class="muted">com stock e sem vendas ${perTxt}</small></h3>
    ${parados.length ? `<p class="hint">Valem ${eur(valParado)} em stock parado. Toca numa peça para lhe pôr desconto ou mudar o destaque.</p>
    <div class="tlist">${parados.slice(0, 60).map(x => `<div class="trow" data-ap="${x.p.id}"><span class="tr-n">💤</span><img src="${S.fotos[x.p.id] || ''}" alt="" loading="lazy">
      <div class="tr-i"><b>${esc(x.p.nome)}</b><small>${x.idade !== null && per && x.idade < per ? `<span class="rnovo">Novo</span> criado há ${x.idade} ${x.idade === 1 ? 'dia' : 'dias'}` : 'Sem vendas ' + perTxt}</small></div>
      <div class="tr-r"><b>${x.st} em stock</b><small>${eur(x.val)}</small></div></div>`).join('')}</div>
    ${parados.length > 60 ? `<p class="hint">E mais ${parados.length - 60}.</p>` : ''}` : '<div class="empty">Nenhuma peça parada. 🎉</div>'}
  </section>`;
  $$('[data-per]').forEach(b => b.onclick = () => { X.periodo = +b.dataset.per; analiseView(); });
  $$('[data-ori]').forEach(b => b.onclick = () => { X.origem = b.dataset.ori; analiseView(); });
  $$('[data-ap]').forEach(r => r.onclick = () => abrirProduto(r.dataset.ap));
}

/* =================== menu "Mais" no telemóvel =================== */
const SECUNDARIAS = ['categorias', 'cupoes', 'analise', 'clientes', 'campanha'];
function marcarMais() { const m = $('#tabMais'); if (m) m.classList.toggle('on', SECUNDARIAS.includes(S.v)); }
function abrirMais() {
  const it = $$('#tabs a[data-v]').filter(a => SECUNDARIAS.includes(a.dataset.v));
  $('#dbox').innerHTML = `<div class="dh"><h2>Mais</h2><button class="x" data-x aria-label="Fechar">✕</button></div>
    <div class="maisg">${it.map(a => `<button class="mais-b ${S.v === a.dataset.v ? 'on' : ''}" data-mv="${a.dataset.v}"><i>${a.querySelector('i').textContent}</i><span>${a.querySelector('.tl').textContent}</span></button>`).join('')}</div>`;
  $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
  $$('#dbox [data-x]').forEach(b => b.onclick = fechar);
  $$('#dbox [data-mv]').forEach(b => b.onclick = () => { fechar(); go(b.dataset.mv); });
}
