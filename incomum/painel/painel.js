/* Painel Incomum.eu — encomendas, stock e clientes (Supabase, sessão por e-mail + RLS incomum_e_equipa) */
const CFG = window.INCOMUM || {};
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseChave);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const eur = c => ((c || 0) / 100).toFixed(2).replace('.', ',') + ' €';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const data = d => d ? new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const SZ = ['PP', 'XS', 'P', 'S', 'M', 'G', 'L', 'GG', 'XL', 'XXL', 'U', 'Único'];
const szOrd = (a, b) => (SZ.indexOf(a) + 1 || 99) - (SZ.indexOf(b) + 1 || 99) || String(a).localeCompare(b, 'pt', { numeric: true });
const ESTADO = { paga: 'Por preparar', preparacao: 'Em preparação', enviada: 'Enviada', entregue: 'Entregue', pendente: 'A aguardar pagamento', cancelada: 'Cancelada', expirada: 'Não pagou', falhou: 'Pagamento falhou' };
const PREP = ['paga', 'preparacao'], PAGAS = ['paga', 'preparacao', 'enviada', 'entregue'];
const pill = e => `<span class="pill p-${e}">${ESTADO[e] || e}</span>`;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }

const S = { v: 'encomendas', enc: [], fotoVar: {}, filtro: 'paga', q: '', prods: [], fotos: {}, aberto: new Set(), qs: '' };

/* ---------- entrar ---------- */
$('#lform').onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(e.target), err = $('#lerr');
  err.hidden = true;
  const { error } = await sb.auth.signInWithPassword({ email: String(f.get('email')).trim(), password: String(f.get('senha')) });
  if (error) { err.textContent = 'E-mail ou palavra-passe errados.'; err.hidden = false; }
};
$('#sair').onclick = async () => { await sb.auth.signOut(); location.reload(); };
async function entrar() {
  const { data: ok } = await sb.rpc('incomum_e_equipa');
  if (!ok) { await sb.auth.signOut(); $('#lerr').textContent = 'Este e-mail não tem acesso ao painel da Incomum.'; $('#lerr').hidden = false; return; }
  $('#login').hidden = true; $('#app').hidden = false;
  try { await Promise.all([carregarProds(), carregarVendasVar()]); badgeRepor(); } catch { /* fotos das encomendas ficam vazias */ }
  go(location.hash.slice(1) || 'encomendas');
  setInterval(() => { if (S.v === 'encomendas' && !$('#drawer').classList.contains('on')) carregarEnc(); }, 60000);
  // Tempo real: encomendas novas ou mudadas noutro aparelho aparecem logo.
  sb.channel('incomum-painel').on('postgres_changes', { event: '*', schema: 'public', table: 'incomum_encomendas' }, () => {
    clearTimeout(S.rt); S.rt = setTimeout(() => { if (S.v === 'encomendas' && !$('#drawer').classList.contains('on')) carregarEnc(); }, 800);
  }).subscribe();
  // Tempo real do stock: vendas (loja ou online), produtos criados/apagados e stock mudado noutro aparelho.
  const mudouStock = () => {
    clearTimeout(S.rtS); S.rtS = setTimeout(async () => {
      if (S.v === 'produtos' && C.ed) return;               // não mexer enquanto alguém edita um produto
      await Promise.all([carregarProds(), carregarVendasVar()]); badgeRepor();
      if (S.v === 'repor') reporView();
      else if (S.v === 'analise' && X.vendas) carregarAnalise();
    }, 900);
  };
  sb.channel('incomum-stock')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'incomum_variantes' }, mudouStock)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'incomum_produtos' }, mudouStock)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'incomum_vendas_loja' }, mudouStock)
    .subscribe();
  setInterval(() => { if (S.v === 'repor' && !$('#drawer').classList.contains('on')) mudouStock(); }, 60000);
}
// só arranca depois de catalogo.js e extras.js carregarem (em redes lentas a sessão chegava antes)
const arrancar = () => {
  sb.auth.getSession().then(({ data }) => { if (data.session) entrar(); });
  sb.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_IN' && s && $('#app').hidden) entrar(); });
};
if (document.readyState === 'complete') arrancar(); else window.addEventListener('load', arrancar);

/* ---------- navegação ---------- */
$$('#tabs a').forEach(a => a.onclick = () => go(a.dataset.v));
function go(v) {
  if (v === 'stock') v = 'produtos';
  if (v === 'mais') return abrirMais();
  if (!['encomendas', 'venda', 'produtos', 'repor', 'cupoes', 'analise', 'categorias', 'clientes', 'campanha'].includes(v)) v = 'encomendas';
  S.v = v; history.replaceState(null, '', '#' + v);
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  if (typeof marcarMais === "function") marcarMais();
  ({ encomendas: carregarEnc, venda: carregarVenda, produtos: carregarProdutos, repor: carregarRepor, cupoes: carregarCupoes, analise: carregarAnalise, categorias: carregarCategorias, clientes: carregarClientes, campanha: carregarCampanha })[v]();
}

/* ---------- encomendas ---------- */
async function carregarEnc() {
  const { data, error } = await sb.from('incomum_encomendas').select('*, itens:incomum_itens(*)').order('criado', { ascending: false }).limit(500);
  if (error) return toast('Não foi possível carregar as encomendas');
  S.enc = data;
  const n = data.filter(e => PREP.includes(e.estado)).length;
  $('#nNovas').hidden = !n; $('#nNovas').textContent = n;
  if (S.v === 'encomendas') encView();
}
function encView() {
  const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
  const pagas = S.enc.filter(e => PAGAS.includes(e.estado));
  const doMes = pagas.filter(e => new Date(e.pago_em || e.criado) >= mes);
  const antigas = (a, b) => new Date(a.pago_em || a.criado) - new Date(b.pago_em || b.criado);
  const porPreparar = S.enc.filter(e => PREP.includes(e.estado)).sort(antigas);
  const F = [['paga', `Por preparar${porPreparar.length ? ' · ' + porPreparar.length : ''}`], ['enviada', 'Enviadas'], ['entregue', 'Entregues'], ['pendente', 'A aguardar pagamento'], ['', 'Todas']];
  const q = S.q.toLowerCase();
  const L = S.enc.filter(e => (!S.filtro || (S.filtro === 'paga' ? PREP.includes(e.estado) : e.estado === S.filtro)) && (!q || `${e.numero} ${e.nome} ${e.email} ${e.telefone}`.toLowerCase().includes(q)));
  const prep = S.filtro === 'paga';
  const lista = prep
    ? (L.length
      ? `<p class="hint">As mais antigas primeiro. Carrega em <b>Começar a preparar</b> (o cliente vê logo), separa cada peça e marca a caixa. Quando a encomenda sair, carrega em <b>Marcar como enviada</b>.</p>` + [...L].sort(antigas).map(prepHTML).join('')
      : '<div class="card"><div class="empty">Nada por preparar. 🎉</div></div>')
    : `${porPreparar.length ? `<button class="alert" data-f="paga">📦 ${porPreparar.length} encomenda${porPreparar.length > 1 ? 's' : ''} por preparar →</button>` : ''}
    <div class="card">${L.length ? L.map(e => `<div class="row" data-id="${e.id}">
      <span class="n">#${e.numero}</span>
      <span>${esc(e.nome || 'Sem nome ainda')}<small>${e.itens.reduce((x, i) => x + i.qtd, 0)} peça(s) · ${esc(e.morada?.cidade || '')}</small></span>
      <span class="muted">${data(e.criado)}</span>
      ${pill(e.estado)}<span class="t">${eur(e.total)}</span><span class="muted">›</span></div>`).join('') : '<div class="empty">Sem encomendas aqui.</div>'}</div>`;
  $('#view').innerHTML = `
    <div class="kpis">
      <div class="kpi hot${porPreparar.length ? ' on' : ''}"><small>Por preparar</small><b>${porPreparar.length}</b></div>
      <div class="kpi"><small>Vendas online este mês</small><b>${eur(doMes.reduce((a, e) => a + e.total, 0))}</b></div>
      <div class="kpi"><small>Encomendas este mês</small><b>${doMes.length}</b></div>
      <div class="kpi"><small>Peças vendidas</small><b>${pagas.reduce((a, e) => a + e.itens.reduce((x, i) => x + i.qtd, 0), 0)}</b></div>
    </div>
    <div class="bar">${F.map(([k, t]) => `<button class="chip${S.filtro === k ? ' on' : ''}${k === 'paga' && porPreparar.length ? ' hotchip' : ''}" data-f="${k}">${t}</button>`).join('')}
      <input class="search" id="qe" placeholder="Procurar n.º, nome, e-mail…" value="${esc(S.q)}"><button class="ghost" id="rec">Atualizar</button></div>
    ${lista}`;
  $$('[data-f]').forEach(b => b.onclick = () => { S.filtro = b.dataset.f; encView(); });
  $('#qe').oninput = e => { S.q = e.target.value; const p = e.target.selectionStart; encView(); $('#qe').focus(); $('#qe').setSelectionRange(p, p); };
  $('#rec').onclick = () => carregarEnc().then(() => toast('Atualizado'));
  $$('.row[data-id]').forEach(r => r.onclick = () => abrirEnc(r.dataset.id));
  ligarPrep();
}
const ilhas = m => /^9\d{3}/.test(String(m?.codigo_postal || '').trim());
function clienteHTML(e) {
  const m = e.morada || {};
  return `<div class="cli">
    <b>${esc(m.nome || e.nome || '—')}</b>
    ${m.linha1 ? `<span>${esc(m.linha1)}${m.linha2 ? ', ' + esc(m.linha2) : ''}</span><span>${esc(m.codigo_postal)} ${esc(m.cidade)}</span>` : '<span class="muted">Ainda sem morada (pagamento não concluído)</span>'}
    ${e.telefone ? `<span><a href="tel:${esc(e.telefone)}">${esc(e.telefone)}</a> · <a href="https://wa.me/${esc(e.telefone.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a></span>` : ''}
    ${e.email ? `<span><a href="mailto:${esc(e.email)}">${esc(e.email)}</a></span>` : ''}
    ${ilhas(m) ? '<span class="warn">⚠️ Código postal dos Açores ou da Madeira: só enviamos para Portugal continental. Fala com o cliente antes de enviar.</span>' : ''}
  </div>`;
}
function prepHTML(e) {
  const feitas = e.itens.filter(i => i.separado).length, todas = feitas === e.itens.length;
  return `<article class="prep${todas ? ' pronta' : ''}">
    <header><div><h3>Encomenda #${e.numero}</h3><small class="muted">Paga ${data(e.pago_em || e.criado)} · ${eur(e.total)}</small></div>${pill(e.estado)}</header>
    <div class="prog"><span style="width:${e.itens.length ? feitas / e.itens.length * 100 : 0}%"></span></div>
    <p class="prog-t">${todas ? '✓ Todas as peças separadas' : `${feitas} de ${e.itens.length} peça${e.itens.length > 1 ? 's' : ''} separada${feitas === 1 ? '' : 's'}`}</p>
    <div class="cols">
      <ul class="picks">${e.itens.map(i => `<li><label class="pick${i.separado ? ' ok' : ''}">
        <input type="checkbox" data-item="${i.id}" ${i.separado ? 'checked' : ''}>
        <img src="${S.fotoVar[i.variante_id] || ''}" alt="" loading="lazy">
        <span class="pi"><b>${esc(i.produto)}</b><span>${i.tam ? `<em class="tam">${esc(i.tam)}</em>` : ''}${esc(i.cor || '')}</span></span>
        <span class="q">× ${i.qtd}</span></label></li>`).join('')}</ul>
      <div><h4>Enviar para</h4>${clienteHTML(e)}</div>
    </div>
    <footer>${e.estado === 'paga' ? `<button class="btn grad" data-prep="${e.id}">Começar a preparar</button><button class="btn" data-env="${e.id}">Marcar como enviada</button>` : `<button class="btn grad" data-env="${e.id}">Marcar como enviada</button>`}<button class="ghost" data-ver="${e.id}">Detalhes</button></footer>
  </article>`;
}
function ligarPrep() {
  $$('.prep input[data-item]').forEach(c => c.onchange = async () => {
    const id = +c.dataset.item, val = c.checked;
    const enc = S.enc.find(e => e.itens.some(i => i.id === id)), it = enc.itens.find(i => i.id === id);
    it.separado = val; encView();
    const { error } = await sb.from('incomum_itens').update({ separado: val }).eq('id', id);
    if (error) { it.separado = !val; encView(); toast('Não foi possível guardar'); }
  });
  $$('[data-env]').forEach(b => b.onclick = async () => {
    const e = S.enc.find(x => x.id === b.dataset.env);
    if (e.itens.some(i => !i.separado) && !confirm('Ainda há peças por marcar como separadas. Marcar a encomenda como enviada mesmo assim?')) return;
    abrirEnc(e.id); // o envio pede a transportadora e o número de seguimento
    setTimeout(() => $('#segN')?.focus(), 250);
  });
  $$('[data-prep]').forEach(b => b.onclick = async () => {
    const e = S.enc.find(x => x.id === b.dataset.prep);
    b.disabled = true;
    const { error } = await sb.from('incomum_encomendas').update({ estado: 'preparacao' }).eq('id', e.id);
    if (error) { b.disabled = false; return toast('Não foi possível mudar o estado'); }
    toast(`Encomenda #${e.numero} em preparação`); carregarEnc();
  });
  $$('[data-ver]').forEach(b => b.onclick = () => abrirEnc(b.dataset.ver));
}
function abrirEnc(id) {
  const e = S.enc.find(x => x.id === id); if (!e) return;
  const m = e.morada || {}, ordem = ['paga', 'preparacao', 'enviada', 'entregue'], k = ordem.indexOf(e.estado);
  $('#dbox').innerHTML = `
    <div class="dh"><div><h2>Encomenda #${e.numero}</h2><p class="muted">${data(e.criado)}</p></div><button class="x" data-x>×</button></div>
    ${pill(e.estado)}
    ${k >= 0 ? `<div class="steps">${ordem.map((_, i) => `<span class="${i <= k ? 'on' : ''}"></span>`).join('')}</div>` : ''}
    <div class="sec"><h4>Peças</h4>${e.itens.map(i => `<div class="it"><span><b>${i.qtd}× ${esc(i.produto)}</b><small>${[i.cor, i.tam && 'Tam. ' + i.tam].filter(Boolean).map(esc).join(' · ')}</small></span><span>${eur(i.preco * i.qtd)}</span></div>`).join('')}
      <div class="tot"><span>Subtotal</span><span>${eur(e.subtotal)}</span></div>${e.desconto > 0 ? `<div class="tot"><span>Inclui ${esc(e.campanha || 'desconto')} −${e.desconto_pct}%</span><span>−${eur(e.desconto)}</span></div>` : ''}<div class="tot"><span>Portes</span><span>${e.portes ? eur(e.portes) : 'Grátis'}</span></div><div class="tot b"><span>Total</span><span>${eur(e.total)}</span></div></div>
    <div class="sec"><h4>Cliente e morada de envio</h4>${clienteHTML(e)}</div>
    ${e.pago_em ? `<div class="sec"><h4>Histórico</h4><p class="muted">Paga: ${data(e.pago_em)}${e.preparacao_em ? '<br>Em preparação: ' + data(e.preparacao_em) : ''}${e.enviado_em ? '<br>Enviada: ' + data(e.enviado_em) : ''}${e.entregue_em ? '<br>Entregue: ' + data(e.entregue_em) : ''}</p></div>` : ''}
    ${[...PREP, 'enviada'].includes(e.estado) ? `<div class="sec seg"><h4>Envio</h4>
      <label>Transportadora<select id="segT">${TRANSP.map(t => `<option${(e.transportadora || 'CTT') === t ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>N.º de seguimento<input id="segN" value="${esc(e.seguimento || '')}" placeholder="Ex.: RR123456789PT" maxlength="40" autocomplete="off"></label>
      <p class="muted">O cliente vê-o logo na conta, com o link para seguir o envio.</p>
      ${e.estado === 'enviada' ? '<button class="btn" data-seg>Guardar seguimento</button>' : ''}</div>` : ''}
    <div class="acts">
      ${e.estado === 'paga' ? '<button class="btn grad" data-e="preparacao">Começar a preparar</button>' : ''}
      ${PREP.includes(e.estado) ? `<button class="btn ${e.estado === 'paga' ? '' : 'grad'}" data-e="enviada">Marcar como enviada</button>` : ''}
      ${e.estado === 'enviada' ? '<button class="btn grad" data-e="entregue">Marcar como entregue</button>' : ''}
      ${['paga', 'preparacao', 'enviada'].includes(e.estado) ? '<button class="btn bad" data-e="cancelada">Cancelar e repor stock</button>' : ''}
    </div>`;
  $$('#dbox [data-x]').forEach(b => b.onclick = fechar);
  $$('#dbox [data-e]').forEach(b => b.onclick = async () => {
    const novo = b.dataset.e;
    if (novo === 'cancelada' && !confirm(`Cancelar a encomenda #${e.numero}? As peças voltam ao stock. O reembolso faz-se no Stripe.`)) return;
    const mud = { estado: novo };
    if (novo === 'enviada') {
      const seg = lerSeg(); if (seg === null) return;
      if (!seg.seguimento && !confirm('Sem número de seguimento? O cliente só vai ver "Enviada". Podes acrescentá-lo depois.')) return;
      Object.assign(mud, seg);
    }
    b.disabled = true;
    const { error } = await sb.from('incomum_encomendas').update(mud).eq('id', e.id);
    if (error) { b.disabled = false; return toast('Não foi possível mudar o estado'); }
    toast(novo === 'preparacao' ? 'Em preparação (o cliente já vê)' : novo === 'enviada' ? 'Marcada como enviada' : novo === 'entregue' ? 'Marcada como entregue' : 'Encomenda cancelada');
    await carregarEnc(); abrirEnc(e.id);
  });
  const bs = $('#dbox [data-seg]');
  if (bs) bs.onclick = async () => {
    const seg = lerSeg(); if (seg === null) return;
    bs.disabled = true;
    const { error } = await sb.from('incomum_encomendas').update(seg).eq('id', e.id);
    bs.disabled = false;
    if (error) return toast('Não foi possível guardar o seguimento');
    toast('Seguimento guardado (o cliente já vê)'); await carregarEnc(); abrirEnc(e.id);
  };
  $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
}
const TRANSP = ['CTT', 'DPD', 'GLS', 'SEUR', 'Nacex', 'UPS', 'Outra'];
function lerSeg() {
  const n = ($('#segN')?.value || '').trim().toUpperCase(), t = $('#segT')?.value || 'CTT';
  if (n && !/^[A-Z0-9 -]{4,40}$/.test(n)) { toast('O número de seguimento só pode ter letras, números e espaços'); $('#segN').focus(); return null; }
  return { transportadora: n ? t : null, seguimento: n || null };
}
function fechar() { $('#drawer').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); }
$('#drawer .scrim').onclick = fechar;
document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });

/* ---------- stock ---------- */
async function carregarStock() {
  $('#view').innerHTML = '<div class="empty">A carregar o stock…</div>';
  const { data, error } = await sb.from('incomum_produtos').select('id, nome, ativo, ordem, variantes:incomum_variantes(id, cor, tam, stock, preco)').order('nome');
  if (error) return toast('Não foi possível carregar o stock');
  S.prods = data; stockView();
}
function stockView() {
  const q = S.qs.toLowerCase(), L = S.prods.filter(p => !q || p.nome.toLowerCase().includes(q) || p.variantes.some(v => (v.cor || '').toLowerCase().includes(q)));
  const zero = S.prods.reduce((a, p) => a + p.variantes.filter(v => !v.stock).length, 0);
  $('#view').innerHTML = `
    <div class="kpis"><div class="kpi"><small>Produtos</small><b>${S.prods.length}</b></div><div class="kpi"><small>Unidades em stock</small><b>${S.prods.reduce((a, p) => a + p.variantes.reduce((x, v) => x + v.stock, 0), 0)}</b></div>
      <div class="kpi"><small>Combinações esgotadas</small><b>${zero}</b></div><div class="kpi"><small>Dica</small><b style="font-size:13px;font-weight:600">Toca num produto e usa − / + ou escreve o número</b></div></div>
    <div class="bar"><input class="search" id="qs" placeholder="Procurar produto ou cor…" value="${esc(S.qs)}"></div>
    <div class="card" id="plist">${L.map(prodHTML).join('') || '<div class="empty">Nenhum produto.</div>'}</div>`;
  $('#qs').oninput = e => { S.qs = e.target.value; const p = e.target.selectionStart; stockView(); $('#qs').focus(); $('#qs').setSelectionRange(p, p); };
  ligarStock();
}
function prodHTML(p) {
  const u = p.variantes.reduce((a, v) => a + v.stock, 0), aberto = S.aberto.has(p.id);
  const cores = [...new Set(p.variantes.map(v => v.cor || '—'))], tams = [...new Set(p.variantes.map(v => v.tam || '—'))].sort(szOrd);
  return `<div class="prod" data-p="${p.id}"><div class="ph"><img src="${S.fotos[p.id] || ''}" alt="" loading="lazy"><span><b>${esc(p.nome)}</b></span><span class="u${u ? '' : ' zero'}">${u ? u + ' un.' : 'Esgotado'}</span><span class="muted">${aberto ? '▾' : '▸'}</span></div>
    ${aberto ? `<div class="mx"><table><tr><th></th>${tams.map(t => `<th>${esc(t)}</th>`).join('')}</tr>${cores.map(c => `<tr><th>${esc(c)}</th>${tams.map(t => {
      const v = p.variantes.find(x => (x.cor || '—') === c && (x.tam || '—') === t);
      return v ? `<td><div class="st${v.stock ? '' : ' zero'}" data-v="${v.id}"><button data-d="-1" aria-label="Menos">−</button><input type="number" min="0" inputmode="numeric" value="${v.stock}"><button data-d="1" aria-label="Mais">+</button></div></td>` : '<td class="na">—</td>';
    }).join('')}</tr>`).join('')}</table></div>` : ''}</div>`;
}
function ligarStock() {
  $$('.prod .ph').forEach(h => h.onclick = () => { const id = h.parentElement.dataset.p; S.aberto.has(id) ? S.aberto.delete(id) : S.aberto.add(id); h.parentElement.outerHTML = prodHTML(S.prods.find(p => p.id === id)); ligarStock(); });
  $$('.st').forEach(st => {
    const inp = st.querySelector('input');
    st.querySelectorAll('button').forEach(b => b.onclick = () => { inp.value = Math.max(0, (+inp.value || 0) + +b.dataset.d); guardar(st, inp); });
    inp.onchange = () => { inp.value = Math.max(0, Math.round(+inp.value || 0)); guardar(st, inp); };
  });
}
const timers = {};
function guardar(st, inp) {
  const id = st.dataset.v, n = +inp.value;
  st.classList.toggle('zero', !n);
  clearTimeout(timers[id]);
  timers[id] = setTimeout(async () => {
    const { error } = await sb.from('incomum_variantes').update({ stock: n, atualizado: new Date().toISOString() }).eq('id', id);
    if (error) return toast('Não foi possível guardar');
    for (const p of S.prods) { const v = p.variantes.find(x => x.id === id); if (v) { v.stock = n; const u = p.variantes.reduce((a, x) => a + x.stock, 0), el = document.querySelector(`[data-p="${p.id}"] .u`); if (el) { el.textContent = u ? u + ' un.' : 'Esgotado'; el.classList.toggle('zero', !u); } } }
    st.classList.add('saved'); setTimeout(() => st.classList.remove('saved'), 700);
  }, 450);
}

/* ---------- clientes ---------- */
async function carregarClientes() {
  const { data: cl, error } = await sb.from('incomum_clientes').select('*').order('ultima', { ascending: false });
  if (error) return toast('Não foi possível carregar os clientes');
  $('#view').innerHTML = `<div class="kpis"><div class="kpi"><small>Clientes</small><b>${cl.length}</b></div><div class="kpi"><small>Voltaram a comprar</small><b>${cl.filter(c => c.encomendas > 1).length}</b></div></div>
    <div class="card">${cl.length ? cl.map(c => `<div class="row" style="cursor:default"><span class="n">${c.encomendas}×</span><span>${esc(c.nome || '—')}<small>${esc(c.email)}</small></span><span class="muted">${esc(c.telefone || '')}</span><span class="muted">${data(c.ultima)}</span><span class="t">${eur(c.gasto)}</span><span></span></div>`).join('') : '<div class="empty">Ainda não há clientes online.</div>'}</div>`;
}

/* ---------- campanha (desconto por nº de peças; o servidor aplica-o no pagamento) ---------- */
async function carregarCampanha() {
  $('#view').innerHTML = '<p class="muted">A carregar…</p>';
  const { data: c, error } = await sb.from('incomum_campanha').select('*').eq('id', 1).maybeSingle();
  if (error || !c) { $('#view').innerHTML = '<p class="muted">Não foi possível carregar a campanha.</p>'; return; }
  const fim = new Date(c.fim), local = new Date(fim.getTime() - fim.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const aDecorrer = c.ativa && Date.now() < fim.getTime();
  const esc3 = [...(c.escaloes || [])].sort((a, b) => a.pecas - b.pecas);
  while (esc3.length < 3) esc3.push({ pecas: esc3.length + 1, pct: 0 });
  $('#view').innerHTML = `<section class="card camp">
    <div class="camp-h"><div><h2>${esc(c.nome)}</h2><p class="muted">${aDecorrer ? `A decorrer · acaba ${data(c.fim)}` : c.ativa ? 'Terminou (a data de fim já passou)' : 'Desligada'}</p></div>
      <label class="sw"><input type="checkbox" id="cAtiva" ${c.ativa ? 'checked' : ''}><span></span>Ligada</label></div>
    <label>Nome<input id="cNome" value="${esc(c.nome)}" maxlength="40"></label>
    <label>Acaba em<input id="cFim" type="datetime-local" value="${local}"></label>
    <h4>Desconto por número de peças no saco</h4>
    <div class="esc">${esc3.slice(0, 3).map((t, i) => `<label>${i === 2 ? '3 ou mais peças' : (i + 1) + ' peça' + (i ? 's' : '')}<span><input type="number" min="0" max="90" step="1" data-pct="${i}" value="${t.pct}">%</span></label>`).join('')}</div>
    <p class="muted">O desconto aplica-se a todas as peças do saco e é cobrado automaticamente no pagamento. Põe 0% para não haver desconto nesse escalão.</p>
    <button class="btn grad" id="cGuardar">Guardar campanha</button>
  </section>
  <section class="card cpz" id="campPecas"><div class="empty">A carregar as peças…</div></section>`;
  campPecas();
  $('#cGuardar').onclick = async () => {
    const pcts = $$('[data-pct]').map(i => Math.round(+i.value || 0));
    if (pcts.some(p => p < 0 || p > 90)) return toast('Cada desconto tem de estar entre 0% e 90%');
    const escaloes = pcts.map((pct, i) => ({ pecas: i + 1, pct })).filter(t => t.pct > 0);
    const fimN = new Date($('#cFim').value);
    if (isNaN(fimN)) return toast('Escolhe a data de fim');
    const nome = $('#cNome').value.trim() || 'Campanha';
    $('#cGuardar').disabled = true;
    const { error } = await sb.from('incomum_campanha').update({ ativa: $('#cAtiva').checked, nome, fim: fimN.toISOString(), escaloes, atualizado: new Date().toISOString() }).eq('id', 1);
    $('#cGuardar').disabled = false;
    if (error) return toast('Não foi possível guardar');
    toast('Campanha guardada (a loja já mostra)'); carregarCampanha();
  };
}
