/* Incomum.eu — loja (estática; o pagamento liga-se em config.js na etapa 2) */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const eur = n => n.toFixed(2).replace('.', ',') + ' €';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CFG = window.INCOMUM || {};
const SZ = ['PP', 'XS', 'P', 'S', 'M', 'G', 'L', 'GG', 'XL', 'XXL', 'U', 'Único'];
const szOrd = (a, b) => (SZ.indexOf(a) + 1 || 99) - (SZ.indexOf(b) + 1 || 99) || String(a).localeCompare(b, 'pt', { numeric: true });
const COR = { preto: '#161616', black: '#161616', branco: '#fafafa', white: '#fafafa', 'off white': '#f3efe6', cru: '#efe6d6', bege: '#d9c3a5', nude: '#e1bfa6', areia: '#d8c7a8', creme: '#f1e6cf', cinza: '#9a9a9a', chumbo: '#4a4d52', grafite: '#3b3d42', mescla: '#b5b5b5', prata: '#c9c9cc', rosa: '#e9a6b8', pink: '#ec5f9c', fúcsia: '#d4237a', fucsia: '#d4237a', magenta: '#c2185b', lilás: '#b9a3dc', lavanda: '#c7b8e8', roxo: '#6b3fa0', uva: '#5b2a5e', vinho: '#6d1f2e', bordô: '#6d1f2e', berry: '#8e2c5a', vermelho: '#c8232c', coral: '#ef7a64', laranja: '#ef7d3c', terracota: '#b65a3b', amarelo: '#f2c94c', mostarda: '#c99a2e', dourado: '#c9a14a', lima: '#c7d94a', verde: '#5f8a5b', militar: '#55603f', oliva: '#6b7041', menta: '#a8dcc6', esmeralda: '#1f7a5a', petróleo: '#1e5560', azul: '#3d63b8', marinho: '#1d2a4d', navy: '#1d2a4d', turquesa: '#2bb3c0', jeans: '#4b6b93', marrom: '#7a4e33', castanho: '#7a4e33', chocolate: '#4e3326', café: '#5b3d2b', caramelo: '#b07a46', camel: '#b9895a', cappuccino: '#a58468', taupe: '#8c7b6e', estampado: 'conic-gradient(#e9a6b8,#b9a3dc,#a8dcc6,#f2c94c,#e9a6b8)' };
function hex(c) {
  const k = (c || '').toLowerCase().trim();
  if (COR[k]) return COR[k];
  for (const w of Object.keys(COR).sort((a, b) => b.length - a.length)) if (k.includes(w)) return COR[w];
  let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 25% 62%)`;
}

const S = { prods: [], cats: [], by: {}, byVar: {}, shown: 24, F: { cat: '', col: '', size: '', q: '', sort: '' }, cart: [] };
try { S.cart = JSON.parse(localStorage.getItem('incomum-saco') || '[]'); } catch {}
const save = () => { try { localStorage.setItem('incomum-saco', JSON.stringify(S.cart)); } catch {} };

const vPrice = v => v.promo || v.preco;
const avail = (p, cor, tam) => p.variantes.some(v => v.disp && (!cor || v.cor === cor) && (!tam || v.tam === tam));
const sizes = p => [...new Set(p.variantes.map(v => v.tam).filter(Boolean))].sort(szOrd);
const priceHTML = p => {
  const v = p.variantes.filter(x => x.disp).sort((a, b) => vPrice(a) - vPrice(b))[0] || p.variantes[0];
  return v && v.promo && v.promo < v.preco ? `${eur(v.promo)}<s>${eur(v.preco)}</s>` : eur(p.preco);
};
const wa = t => `https://wa.me/${CFG.whatsapp || '351910202105'}?text=${encodeURIComponent(t)}`;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2400); }

/* ---------- arranque ---------- */
async function load() {
  const d = await (await fetch('catalogo.json')).json();
  S.prods = d.produtos.sort((a, b) => (b.destaque - a.destaque) || (a.ordem - b.ordem));
  S.cats = d.categorias; S.portes = d.portes;
  for (const p of S.prods) { S.by[p.slug] = p; for (const v of p.variantes) S.byVar[v.id] = { p, v }; }
  await stockAoVivo();
  S.cart = S.cart.filter(i => S.byVar[i.v]);
  nav(); rail(); filters(); grid(); cartUI(); route();
}
// Preço e stock reais vêm da base de dados (o catalogo.json só traz fotos e textos).
async function stockAoVivo() {
  if (!CFG.supabaseUrl) return;
  try {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/incomum_variantes?select=id,preco,promo,stock&limit=5000`, { headers: { apikey: CFG.supabaseChave } });
    if (!r.ok) return;
    const vivos = new Map((await r.json()).map(x => [x.id, x]));
    if (!vivos.size) return;
    for (const p of S.prods) {
      for (const v of p.variantes) {
        const x = vivos.get(v.id);
        if (!x) { v.disp = false; v.stock = 0; continue; }
        v.preco = x.preco / 100; v.promo = x.promo ? x.promo / 100 : null; v.stock = x.stock; v.disp = x.stock > 0;
      }
      const ps = p.variantes.filter(v => v.disp).map(vPrice);
      if (ps.length) p.preco = Math.min(...ps);
    }
  } catch { /* sem ligação: fica o catálogo */ }
}

function nav() {
  const L = [['#loja', 'Coleção', ''], ['#loja', 'Leggings', 'leggings-calcas'], ['#loja', 'Tops', 'tops-croppeds-camisolas'], ['#loja', 'Shorts', 'shorts-bermudas'], ['#visita', 'Loja física', null]];
  const h = L.map(([href, t, c]) => `<a href="${href}"${c !== null ? ` data-cat="${c}"` : ''}>${t}</a>`).join('');
  $('#nav').innerHTML = h; $('#mlinks').innerHTML = h + '<a href="conta.html">A minha conta · encomendas</a>';
  $$('[data-cat]').forEach(a => a.addEventListener('click', () => { S.F.cat = a.dataset.cat; S.shown = 24; filters(); grid(); drawer('#mnav', false); }));
  $$('#mlinks a').forEach(a => a.addEventListener('click', () => drawer('#mnav', false)));
}

/* ---------- destaques ---------- */
function rail() {
  const six = S.prods.filter(p => /six\s*pocket/i.test(p.nome) && avail(p));
  const all = S.prods.filter(p => /allu?re/i.test(p.nome) && avail(p));
  const L = [...six.slice(0, 3), ...all.slice(0, 7)];
  $('#rail').innerHTML = L.map(card).join('');
}

/* ---------- filtros e lista ---------- */
function filters() {
  const tipos = S.cats.filter(c => c.grupo === 'tipo'), cols = S.cats.filter(c => c.grupo === 'colecao');
  const chip = (k, v, t) => `<button class="chip${S.F[k] === v ? ' on' : ''}" data-k="${k}" data-v="${esc(v)}">${esc(t)}</button>`;
  $('#cats').innerHTML = chip('cat', '', 'Tudo') + tipos.map(c => chip('cat', c.slug, c.nome)).join('');
  $('#cols').innerHTML = chip('col', '', 'Todas') + cols.map(c => chip('col', c.slug, c.nome)).join('');
  const all = [...new Set(S.prods.flatMap(p => p.variantes.filter(v => v.disp).map(v => v.tam)).filter(Boolean))].sort(szOrd);
  $('#fsizes').innerHTML = chip('size', '', 'Todos') + all.map(s => chip('size', s, s)).join('');
  $$('.filters .chip').forEach(b => b.onclick = () => { const k = b.dataset.k; S.F[k] = S.F[k] === b.dataset.v ? '' : b.dataset.v; S.shown = 24; filters(); grid(); });
}
function list() {
  const { cat, col, size, q, sort } = S.F, n = q.trim().toLowerCase();
  let L = S.prods.filter(p => (!cat || p.categorias.includes(cat)) && (!col || p.categorias.includes(col)) && (!size || avail(p, '', size)) && (!n || (p.nome + ' ' + p.cores.join(' ')).toLowerCase().includes(n)));
  if (sort === 'asc') L = [...L].sort((a, b) => a.preco - b.preco);
  if (sort === 'desc') L = [...L].sort((a, b) => b.preco - a.preco);
  if (sort === 'az') L = [...L].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  if (!sort) L = [...L].sort((a, b) => avail(b) - avail(a));
  return L;
}
function card(p) {
  const ok = avail(p), cores = p.cores.slice(0, 6);
  return `<a class="card" href="#p/${p.slug}">
    <div class="ph"><img class="a" src="${p.imgs[0]}" alt="${esc(p.nome)}" loading="lazy">${p.imgs[1] ? `<img class="b" src="${p.imgs[1]}" alt="" loading="lazy">` : ''}
      ${!ok ? '<span class="tag out">Esgotado</span>' : p.destaque ? '<span class="tag">Mais procurado</span>' : ''}</div>
    <div class="ci"><h3>${esc(p.nome)}</h3><p class="price">${priceHTML(p)}</p>
      ${cores.length > 1 ? `<div class="dots">${cores.map(c => `<span class="dot" title="${esc(c)}" style="background:${hex(c)}"></span>`).join('')}</div>` : ''}
      <div class="szs">${sizes(p).map(s => `<span class="${avail(p, '', s) ? '' : 'no'}">${esc(s)}</span>`).join('')}</div></div></a>`;
}
function grid() {
  const L = list();
  $('#grid').innerHTML = L.slice(0, S.shown).map(card).join('');
  $('#count').textContent = `${L.length} peça${L.length === 1 ? '' : 's'}${S.F.size ? ` disponíveis no tamanho ${S.F.size}` : ''}`;
  $('#empty').hidden = L.length > 0;
  $('#moreBtn').hidden = L.length <= S.shown;
}

/* ---------- página de produto ---------- */
const P = { p: null, cor: '', tam: '', q: 1, i: 0 };
function route() {
  const m = location.hash.match(/^#p\/(.+)$/), p = m && S.by[decodeURIComponent(m[1])];
  document.body.classList.toggle('on-pp', !!p);
  $('#home').hidden = !!p; $('#pp').hidden = !p;
  if (p) {
    if (P.p !== p) Object.assign(P, { p, cor: (p.variantes.find(v => v.disp) || p.variantes[0] || {}).cor || '', tam: '', q: 1, i: 0 });
    pp(); scrollTo(0, 0); document.title = `${p.nome} · Incomum.eu`;
  } else {
    P.p = null; document.title = 'Incomum.eu · LIVE! original em Portugal';
    const ob = location.hash.match(/^#obrigado\/(cs_\w+)$/);
    if (ob) return location.replace('obrigado.html?s=' + ob[1]);
    if (location.hash === '#saco') { history.replaceState(null, '', location.pathname); return drawer('#cart', true); }
    const el = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) el.scrollIntoView();
  }
}
function pp() {
  const p = P.p, cores = [...new Set(p.variantes.map(v => v.cor).filter(Boolean))];
  const vImg = (p.variantes.find(v => v.cor === P.cor && v.img) || {}).img;
  const imgs = [...new Set([vImg, ...p.imgs].filter(Boolean))];
  if (P.i >= imgs.length) P.i = 0;
  const tams = [...new Set(p.variantes.filter(v => !P.cor || v.cor === P.cor).map(v => v.tam).filter(Boolean))].sort(szOrd);
  const sel = p.variantes.find(v => (!cores.length || v.cor === P.cor) && (!tams.length || v.tam === P.tam));
  const need = tams.length && !P.tam;
  const cat = S.cats.find(c => c.grupo === 'tipo' && p.categorias.includes(c.slug));
  $('#pp').innerHTML = `<div class="wrap">
    <div class="crumbs"><a href="#loja">Coleção</a>${cat ? `<span>/</span><a href="#loja" data-cat="${cat.slug}">${esc(cat.nome)}</a>` : ''}</div>
    <div class="pd">
      <div class="gal"><div class="thumbs">${imgs.map((u, i) => `<button class="${i === P.i ? 'on' : ''}" data-i="${i}" aria-label="Foto ${i + 1}"><img src="${u}" alt="" loading="lazy"></button>`).join('')}</div>
        <div class="big"><img src="${imgs[P.i]}" alt="${esc(p.nome)}"></div></div>
      <div class="info">
        <p class="eyebrow">LIVE! · Original</p>
        <h1>${esc(p.nome)}</h1>
        <p class="price">${sel ? (sel.promo && sel.promo < sel.preco ? `${eur(sel.promo)}<s>${eur(sel.preco)}</s>` : eur(sel.preco)) : priceHTML(p)}</p>
        <p class="note">IVA incluído · Envio ${eur(S.portes.valor)} para Portugal continental, ${S.portes.prazo}</p>
        ${cores.length ? `<div class="opt"><div class="opt-h">Cor <span>${esc(P.cor)}</span></div><div class="sw">${cores.map(c => `<button class="${c === P.cor ? 'on' : ''}${avail(p, c) ? '' : ' no'}" data-cor="${esc(c)}" title="${esc(c)}" aria-label="${esc(c)}" style="background:${hex(c)}"></button>`).join('')}</div></div>` : ''}
        ${tams.length ? `<div class="opt"><div class="opt-h">Tamanho <span>${P.tam ? esc(P.tam) : 'escolhe o teu'}</span></div><div class="sz">${tams.map(t => `<button data-tam="${esc(t)}" class="${t === P.tam ? 'on' : ''}" ${avail(p, P.cor, t) ? '' : 'disabled'}>${esc(t)}</button>`).join('')}</div></div>` : ''}
        <div class="buy"><div class="qty"><button data-q="-1" aria-label="Menos">−</button><span>${P.q}</span><button data-q="1" aria-label="Mais">+</button></div>
          <button class="btn" id="addBtn" ${!avail(p) ? 'disabled' : ''}>${!avail(p) ? 'Esgotado' : need ? 'Escolhe o tamanho' : 'Adicionar ao saco'}</button></div>
        <a class="btn ghost ask" href="${wa(`Olá Incomum! Estou a ver *${p.nome}*${P.cor ? ' (' + P.cor + ')' : ''} no site. Que tamanho me aconselham?`)}" target="_blank" rel="noopener">Dúvidas de tamanho? WhatsApp</a>
        <div class="assure">
          <div><svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>Revendedor autorizado LIVE! em Portugal</div>
          <div><svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/></svg>Envio para Portugal continental · ${S.portes.prazo}</div>
          <div><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/></svg>14 dias para devolver (livre resolução)</div>
        </div>
        ${p.descricao ? `<div class="desc"><h4>Detalhes</h4>${esc(p.descricao)}</div>` : ''}
      </div>
    </div>
    <div class="sec"><div class="sh"><div><p class="eyebrow">Combina com</p><h2>Também vais gostar</h2></div></div><div class="rail">${related(p).map(card).join('')}</div></div>
  </div>`;
  $$('#pp .thumbs button').forEach(b => b.onclick = () => { P.i = +b.dataset.i; pp(); });
  $$('#pp [data-cor]').forEach(b => b.onclick = () => { P.cor = b.dataset.cor; P.i = 0; if (P.tam && !avail(p, P.cor, P.tam)) P.tam = ''; pp(); });
  $$('#pp [data-tam]').forEach(b => b.onclick = () => { P.tam = b.dataset.tam; pp(); });
  $$('#pp [data-q]').forEach(b => b.onclick = () => { P.q = Math.max(1, Math.min(10, P.q + +b.dataset.q)); pp(); });
  $$('#pp [data-cat]').forEach(a => a.onclick = () => { S.F.cat = a.dataset.cat; filters(); grid(); });
  $('#addBtn').onclick = () => {
    if (need) { $('.sz').animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 260 }); toast('Escolhe primeiro o tamanho'); return; }
    if (!sel || !sel.disp) return toast('Esta combinação está esgotada');
    add(sel.id, P.q); P.q = 1; pp();
  };
}
function related(p) {
  const tipo = p.categorias.find(c => S.cats.some(k => k.slug === c && k.grupo === 'tipo'));
  const top = /tops|camisol/.test(tipo || ''), alvo = top ? ['leggings-calcas', 'shorts-bermudas'] : ['tops-croppeds-camisolas'];
  return S.prods.filter(x => x !== p && avail(x) && x.categorias.some(c => alvo.includes(c))).sort((a, b) => b.destaque - a.destaque).slice(0, 8);
}

/* ---------- saco ---------- */
function add(vid, q) {
  const it = S.cart.find(i => i.v === vid);
  const max = Math.min(10, S.byVar[vid].v.stock ?? 10);
  if (it) it.q = Math.min(max, it.q + q); else S.cart.push({ v: vid, q: Math.min(max, q) });
  save(); cartUI(); toast('Adicionado ao saco');
  const b = $('#badge'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  setTimeout(() => drawer('#cart', true), 350);
}
function totals() {
  const sub = S.cart.reduce((a, i) => a + vPrice(S.byVar[i.v].v) * i.q, 0);
  const portes = sub ? S.portes.valor : 0;
  return { sub, portes, tot: sub + portes };
}
function cartUI() {
  const n = S.cart.reduce((a, i) => a + i.q, 0), b = $('#badge');
  b.hidden = !n; b.textContent = n;
  const { sub, portes, tot } = totals();
  $('#ship').innerHTML = !n ? '' : `Envio para <b>Portugal continental</b> · entrega ${S.portes.prazo}`;
  $('#ship').hidden = !n;
  $('#items').innerHTML = !n ? `<div class="cempty"><p>O teu saco está vazio.</p><a class="btn" href="#loja" data-close>Ver a coleção</a></div>` :
    S.cart.map((i, k) => { const { p, v } = S.byVar[i.v]; return `<div class="it"><a href="#p/${p.slug}" data-close><img src="${v.img || p.imgs[0]}" alt=""></a>
      <div><h4>${esc(p.nome)}</h4><small>${[v.cor, v.tam && 'Tam. ' + v.tam].filter(Boolean).map(esc).join(' · ')}</small>
      <div class="qty"><button data-k="${k}" data-d="-1" aria-label="Menos">−</button><span>${i.q}</span><button data-k="${k}" data-d="1" aria-label="Mais">+</button></div></div>
      <div class="r"><span>${eur(vPrice(v) * i.q)}</span><button class="rm" data-rm="${k}">Remover</button></div></div>`; }).join('');
  $('#cfoot').innerHTML = !n ? '' : `<div class="ln"><span>Subtotal</span><span>${eur(sub)}</span></div>
    <div class="ln"><span>Envio Portugal continental</span><span>${eur(portes)}</span></div>
    <div class="ln tot"><span>Total</span><span>${eur(tot)}</span></div>
    <button class="btn block" id="checkout">Finalizar compra</button>
    <p class="paynote">Pagamento seguro com cartão ou MB WAY · IVA incluído<br>Ao continuar aceitas os <a href="termos.html" style="text-decoration:underline">termos de venda</a></p>`;
  $$('#items [data-d]').forEach(x => x.onclick = () => { const i = S.cart[+x.dataset.k]; i.q += +x.dataset.d; if (i.q < 1) S.cart.splice(+x.dataset.k, 1); else i.q = Math.min(10, i.q); save(); cartUI(); });
  $$('#items [data-rm]').forEach(x => x.onclick = () => { S.cart.splice(+x.dataset.rm, 1); save(); cartUI(); });
  $$('#cart [data-close]').forEach(x => x.addEventListener('click', () => drawer('#cart', false)));
  const c = $('#checkout'); if (c) c.onclick = checkout;
}
// Etapa 2: com CFG.checkoutUrl definido, o servidor valida preços/stock e devolve o link do Stripe Checkout.
async function checkout() {
  if (CFG.checkoutUrl && CFG.stripeChave) { save(); location.href = 'checkout.html'; return; }
  // Ainda sem pagamentos online: encomenda pelo WhatsApp com o resumo do saco.
  const { tot, portes } = totals();
  const linhas = S.cart.map(i => { const { p, v } = S.byVar[i.v]; return `• ${i.q}× ${p.nome}${v.cor ? ' · ' + v.cor : ''}${v.tam ? ' · ' + v.tam : ''} — ${eur(vPrice(v) * i.q)}`; });
  open(wa(`Olá! Quero encomendar:\n${linhas.join('\n')}\nEnvio: ${eur(portes)}\nTotal: ${eur(tot)}`), '_blank', 'noopener');
}


/* ---------- gavetas, eventos ---------- */
function drawer(sel, on) { const d = $(sel); d.classList.toggle('on', on); d.setAttribute('aria-hidden', !on); document.body.style.overflow = on ? 'hidden' : ''; }
$$('.drawer .scrim, #mnav [data-close]').forEach(x => x.addEventListener('click', () => drawer('#' + x.closest('.drawer').id, false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.drawer.on').forEach(d => drawer('#' + d.id, false)); });
$('#bagBtn').onclick = () => drawer('#cart', true);
$('#menuBtn').onclick = () => drawer('#mnav', true);
$('#searchBtn').onclick = () => { if (location.hash.startsWith('#p/')) location.hash = 'loja'; setTimeout(() => { $('#loja').scrollIntoView({ behavior: 'smooth' }); $('#q').focus({ preventScroll: true }); }, 50); };
let qt; $('#q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { S.F.q = e.target.value; S.shown = 24; grid(); }, 180); };
$('#sort').onchange = e => { S.F.sort = e.target.value; grid(); };
$('#moreBtn').onclick = () => { S.shown += 24; grid(); };
$('#clearF').onclick = () => { S.F = { cat: '', col: '', size: '', q: '', sort: '' }; $('#q').value = ''; $('#sort').value = ''; filters(); grid(); };
document.addEventListener('click', e => {
  const a = e.target.closest('[data-wa]'); if (!a) return;
  e.preventDefault();
  let t = a.dataset.wa;
  if (a.classList.contains('wa')) {
    if (P.p) t = `Olá Incomum! Estou a ver *${P.p.nome}*${P.cor ? ' (' + P.cor + ')' : ''} no site e tenho uma dúvida.`;
    else if ($('#cart').classList.contains('on') && S.cart.length) t = `Olá Incomum! Tenho ${S.cart.reduce((n, i) => n + i.q, 0)} peça(s) no saco do site e tenho uma dúvida antes de comprar.`;
  }
  open(wa(t), '_blank', 'noopener');
});
addEventListener('hashchange', route);
{ const y = $('#yr'); if (y) y.textContent = new Date().getFullYear(); }
(() => { const v = $('.hero-v'); if (v && matchMedia('(prefers-reduced-motion: reduce)').matches) { v.removeAttribute('autoplay'); v.pause(); } })();
load().catch(() => { $('#grid').innerHTML = '<p>Não foi possível carregar a coleção. Atualiza a página.</p>'; });
