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


const S = { prods: [], cats: [], by: {}, byVar: {}, shown: 24, F: { cat: '', col: '', size: '', q: '', sort: '' }, cart: [], queue: [], note: '', expect: '', on: null, portes: { valor: 10, nome: 'Envio Portugal continental', prazo: 'até 7 dias úteis' } };
try { S.cart = JSON.parse(localStorage.getItem('incomum-saco') || '[]'); } catch {}
S.cupao = cupaoGuardado();
// confirma o cupão guardado (pode ter acabado entretanto)
if (S.cupao) validarCupao(S.cupao.codigo).then(c => { S.cupao = c.ok ? c : null; guardarCupao(S.cupao); if (typeof cartUI === 'function' && S.prods.length) cartUI(); });
const save = () => { try { localStorage.setItem('incomum-saco', JSON.stringify(S.cart)); } catch {} };

/* ---------- preços e campanha ----------
   O desconto real é calculado no servidor: nº total de peças do saco -> escalão mais alto atingido, aplicado a todas
   as peças, sobre o preço atual (promo se existir e for menor, senão preço), com cada preço unitário arredondado ao cêntimo.
   Aqui mostra-se exatamente a mesma conta (cêntimos inteiros). */
const vPrice = v => v.promo && v.promo < v.preco ? v.promo : v.preco;
const cent = v => Math.round(vPrice(v) * 100);                                   // preço atual da variante, em cêntimos
const precoComDesconto = (c, pct) => Math.round(c * (100 - pct) / 100);         // preço unitário com desconto, em cêntimos
const eurC = c => eur(c / 100);
const pctV = (v, r) => Math.max(r || 0, (v && v.desconto) || 0);              // maior entre campanha e desconto da variante
const unit = (v, r) => precoComDesconto(cent(v), pctV(v, r));                   // preço unitário final, em cêntimos
const PORTES = () => Math.round((S.portes && S.portes.valor || 10) * 100);

let CAMP = null; // linha da tabela incomum_campanha (ou null)
const semCamp = /[?&]semcampanha=1(&|$)/.test(location.search); // só para testes
const camp = () => {
  const c = CAMP;
  return !semCamp && c && c.ativa && Date.parse(c.fim) > Date.now() && tiersOf(c).length ? c : null;
};
const tiersOf = c => (Array.isArray(c && c.escaloes) ? c.escaloes : []).filter(t => t && t.pecas > 0 && t.pct > 0).sort((a, b) => a.pecas - b.pecas);
const tiers = () => { const c = camp(); return c ? tiersOf(c) : []; };
const taxa = n => tiers().reduce((r, t) => n >= t.pecas ? Math.max(r, t.pct) : r, 0);   // % de desconto para n peças
const maxTaxa = () => tiers().reduce((r, t) => Math.max(r, t.pct), 0);
const tierTxt = (t, i, a) => { const mais = a.length > 1 && i === a.length - 1; return `${t.pecas}${mais ? ' ou mais' : ''} peça${t.pecas > 1 || mais ? 's' : ''} -${t.pct}%`; };

const TAM_EQ = { PP: 'XS', P: 'S', G: 'L', GG: 'XL' }, tamN = t => TAM_EQ[t] || t;
const avail = (p, cor, tam) => p.variantes.some(v => v.disp && (!cor || v.cor === cor) && (!tam || v.tam === tam || tamN(v.tam) === tam));
const sizes = p => [...new Set(p.variantes.map(v => v.tam).filter(Boolean))].sort(szOrd);
const units = p => p.variantes.filter(v => v.disp).length;
const lowStock = p => { const t = p.variantes.filter(v => typeof v.stock === 'number').reduce((a, v) => a + v.stock, 0); return p.variantes.some(v => typeof v.stock === 'number') && t > 0 && t <= 2; };
// preço atual mais baixo entre as variantes disponíveis (em cêntimos) e o preço riscado, se houver promoção
function from(p, r = taxa(1)) {
  const vs = p.variantes.filter(v => v.disp), l = vs.length ? vs : p.variantes;
  const v = l.slice().sort((a, b) => unit(a, r) - unit(b, r))[0];
  if (!v) { const c = Math.round(p.preco * 100); return { f: c, s: null, c, pre: c, v: null }; }
  const f = unit(v, r), n = Math.round(v.preco * 100);
  return { f, s: n > f ? n : null, c: cent(v), pre: n, v };
}
// com desconto: preço antigo riscado, preço novo em destaque e a percentagem
const fmtFS = (f, s, pct) => {
  if (!(s && s > f)) return `<span class="pnow">${eurC(f)}</span>`;
  const k = pct || Math.round((s - f) / s * 100);
  return `<s class="pold">${eurC(s)}</s><span class="pnow sale">${eurC(f)}</span>${k ? `<span class="poff">-${k}%</span>` : ''}`;
};
const priceHTML = p => { const x = from(p); return fmtFS(x.f, x.s); };
// maior desconto entre as variantes disponíveis (campanha ou desconto do painel)
const maxDesc = (p, r = taxa(1)) => { const vs = p.variantes.filter(v => v.disp); return (vs.length ? vs : p.variantes).reduce((m, v) => Math.max(m, pctV(v, r)), 0); };
const wa = t => `https://wa.me/${CFG.whatsapp || '351910202105'}?text=${encodeURIComponent(t)}`;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2800); }
const parte = (p, x) => p.categorias.some(c => S.cats.some(k => k.slug === c && k.parte === x));
const isTop = p => parte(p, 'cima');
const isBot = p => parte(p, 'baixo');
const DEF = { t1: '', t2: '', lead: '', kick: '' };

/* ---------- arranque ---------- */
async function load() {
  const pc = campanha().then(() => { campaign(); document.body.classList.add('ready'); });   // o topo aparece assim que a campanha responde
  const d = await catalogoVivo();
  S.prods = d.produtos.sort((a, b) => (b.destaque - a.destaque) || (a.ordem - b.ordem));
  S.cats = d.categorias; S.portes = d.portes || S.portes;
  for (const p of S.prods) { S.by[p.slug] = p; for (const v of p.variantes) S.byVar[v.id] = { p, v }; }
  await Promise.all([d.vivo ? null : stockAoVivo(), pc]);
  S.cart = S.cart.filter(i => S.byVar[i.v] && i.q > 0);
  paint(); filters(); route();
  document.body.classList.add('ready');
}
// Campanha (Black Friday) vem da base de dados. Sem resposta ou inativa: a loja fica sem nada de campanha.
async function campanha() {
  if (!CFG.supabaseUrl) return;
  try {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/incomum_campanha?select=ativa,nome,fim,escaloes`, { headers: { apikey: CFG.supabaseChave }, signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    if (!r.ok) return;
    const l = await r.json();
    CAMP = Array.isArray(l) ? (l.find(c => c && c.ativa) || null) : null;
  } catch { /* sem campanha */ }
}
// Preço e stock reais vêm da base de dados (o catalogo.json só traz fotos e textos).
async function stockAoVivo() {
  if (!CFG.supabaseUrl) return;
  try {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/incomum_variantes?select=id,preco,promo,desconto,stock&limit=5000`, { headers: { apikey: CFG.supabaseChave } });
    if (!r.ok) return;
    const vivos = new Map((await r.json()).map(x => [x.id, x]));
    if (!vivos.size) return;
    for (const p of S.prods) {
      for (const v of p.variantes) {
        const x = vivos.get(v.id);
        if (!x) { v.disp = false; v.stock = 0; continue; }
        v.preco = x.preco / 100; v.promo = x.promo ? x.promo / 100 : null; v.desconto = x.desconto || 0; v.stock = x.stock; v.disp = x.stock > 0;
      }
      const ps = p.variantes.filter(v => v.disp).map(vPrice);
      if (ps.length) p.preco = Math.min(...ps);
    }
  } catch { /* sem ligação: fica o catálogo */ }
}

// redesenha tudo o que depende da campanha / preços
function paint() { campaign(); nav(); champs(); sim(); grid(); cartUI(); if (P.p) pp(); observe(); }

/* ---------- campanha na interface ---------- */
function fimTxt(fim) {
  const o = { timeZone: 'Europe/Lisbon' }, d = new Date(fim);
  return `${d.toLocaleDateString('pt-PT', { ...o, weekday: 'long' })} ${d.toLocaleDateString('pt-PT', { ...o, day: '2-digit', month: '2-digit' })}`;
}
function campaign() {
  const c = camp(), on = !!c, ts = tiers();
  S.on = on;
  document.body.classList.toggle('no-bf', !on);
  if (!DEF.t1) Object.assign(DEF, { t1: $('#t1').textContent, t2: $('#t2').textContent, lead: $('#lead').textContent, kick: $('#kick').textContent });
  if (on) {
    const [a, ...b] = c.nome.trim().split(/\s+/);
    $('#t1').textContent = a; $('#t2').textContent = b.join(' ');
    $('#kick').textContent = `Só até ${fimTxt(c.fim)}`;
    $('#lead').textContent = `A LIVE! original, em Portugal. Quanto mais peças levas, maior o desconto: ${ts.map(tierTxt).join(', ')}.`;
    $('#stampPct').textContent = `-${maxTaxa()}%`;
    $('#tbName').textContent = `${c.nome} Incomum`;
  } else {
    $('#t1').textContent = DEF.t1; $('#t2').textContent = DEF.t2; $('#lead').textContent = DEF.lead; $('#kick').textContent = DEF.kick;
  }
  $('#simH').textContent = on ? 'Monta o teu conjunto' : 'Monta o teu look';
  $('#simTxt').textContent = on ? `Escolhe uma parte de cima e uma de baixo e vê já quanto poupas: ${ts.slice(1).map(tierTxt).join(', ')}.` : 'Combina uma parte de cima e uma de baixo e vê o look completo.';
  $('#stepTxt').textContent = on ? `${ts.map(tierTxt).join(' · ')}. O desconto é automático no saco.` : 'Escolhe as peças que quiseres e junta-as ao saco.';
  $('#lojaEye').textContent = on ? 'Tudo com desconto' : 'Coleção';
  const items = on ? [c.nome, ...ts.map(tierTxt), 'LIVE! original', `Envio ${eurC(PORTES())}`] : ['LIVE! original', 'Revendedor autorizado', 'Envio para Portugal continental', '14 dias para devolver'];
  $('#mq').innerHTML = Array(2).fill(items.map(x => `<span>${esc(x)}</span><span>✦</span>`).join('')).join('');
  tick();
}
function tick() {
  const on = !!camp();
  if (S.on !== null && on !== S.on) return paint();   // a campanha acabou: esconde tudo sem recarregar
  if (!on) return;
  const s = Math.max(0, (Date.parse(CAMP.fim) - Date.now()) / 1000 | 0);
  const d = s / 86400 | 0, h = s / 3600 % 24 | 0, m = s / 60 % 60 | 0, x = s % 60, p = n => String(n).padStart(2, '0');
  $$('#cd b').forEach((b, i) => b.textContent = p([d, h, m, x][i]));
  $('#tb').textContent = `${d}d ${p(h)}:${p(m)}:${p(x)}`;
}
setInterval(tick, 1000);

function nav() {
  const bf = !!camp();
  const L = [['#loja', bf ? 'Black Friday' : 'Coleção', '', bf ? 'bf' : ''], ['#loja', 'Leggings', 'leggings-calcas'], ['#loja', 'Tops', 'tops-croppeds-camisolas'], ['#loja', 'Shorts', 'shorts-bermudas'], ['#visita', 'Loja física', null]];
  const h = L.map(([href, t, c, k]) => `<a href="${href}"${c !== undefined && c !== null ? ` data-cat="${c}"` : ''}${k ? ` class="${k}"` : ''}>${t}</a>`).join('');
  $('#nav').innerHTML = h; $('#mlinks').innerHTML = h + (bf ? '<a href="#conjunto">Monta o teu conjunto</a>' : '') + '<a href="conta.html">A minha conta · encomendas</a>';
  $$('[data-cat]').forEach(a => a.addEventListener('click', () => { S.F.cat = a.dataset.cat; S.shown = 24; filters(); grid(); drawer('#mnav', false); }));
  $$('#mlinks a').forEach(a => a.addEventListener('click', () => drawer('#mnav', false)));
}

/* ---------- destaques ---------- */
function champs() {
  const six = S.prods.filter(p => /six\s*pocket/i.test(p.nome) && avail(p)).sort((a, b) => units(b) - units(a));
  const all = S.prods.filter(p => /allu?re/i.test(p.nome) && avail(p)).sort((a, b) => units(b) - units(a));
  const L = [six[0], ...all.slice(0, 4)].filter(Boolean);
  while (L.length < 5) { const x = S.prods.find(p => avail(p) && !L.includes(p)); if (!x) break; L.push(x); }
  $('#champs').innerHTML = L.map((p, i) => { const x = from(p), r = taxa(1), f = x.f, s = x.s;
    return `<a class="champ reveal" href="#p/${p.slug}"><img src="${p.imgs[i === 0 ? 1 : 0] || p.imgs[0]}" alt="${esc(p.nome)}" loading="lazy">
    <div class="ci"><div><span class="ctag">${i === 0 ? 'Mais procurada' : /allu?re/i.test(p.nome) ? 'Tecido Allure' : 'Destaque'}</span><h3>${esc(p.nome)}</h3></div>
    <div class="pp"><b>${eurC(f)}</b>${s ? `<s>${eurC(s)}</s>` : ''}</div><span class="go">→</span></div></a>`; }).join('');
}

/* ---------- simulador de conjunto ---------- */
let simT = null, simB = null, simTops = [], simBots = [];
const simSz = {};
function sim() {
  const pop = f => S.prods.filter(p => f(p) && avail(p)).sort((a, b) => (/allu?re|six/i.test(b.nome) - /allu?re|six/i.test(a.nome)) || units(b) - units(a)).slice(0, 14);
  simTops = pop(isTop); simBots = pop(p => isBot(p) && !isTop(p));
  if (!simTops.includes(simT)) simT = simTops[0] || null;
  if (!simBots.includes(simB)) simB = simBots.find(p => /six/i.test(p.nome)) || simBots[0] || null;
  simDraw();
}
function simDraw() {
  const opt = (p, on) => `<button class="sopt ${on ? 'on' : ''}" data-s="${p.slug}"><img src="${p.imgs[0]}" alt="" loading="lazy"><span><b>${esc(p.nome)}</b><small>${eurC(from(p, 0).f)}</small></span><span class="ck"></span></button>`;
  $('#tops').innerHTML = simTops.map(p => opt(p, p === simT)).join('');
  $('#bots').innerHTML = simBots.map(p => opt(p, p === simB)).join('');
  const sel = [simT, simB].filter(Boolean), n = sel.length, r = taxa(n);
  const norm = sel.reduce((a, p) => a + (simVar(p) ? unit(simVar(p), 0) : from(p, 0).f), 0), tot = sel.reduce((a, p) => a + (simVar(p) ? unit(simVar(p), r) : from(p, r).f), 0);
  const fotoSim = p => (p.variantes.find(v => v.cor === (simSz[p.slug] || {}).cor && v.img) || {}).img || p.imgs[0];
  $('#look').innerHTML = (simT ? `<img src="${fotoSim(simT)}" alt="">` : '<div class="ph">Escolhe um top</div>') + (simB ? `<img src="${fotoSim(simB)}" alt="">` : '<div class="ph">Escolhe a parte de baixo</div>');
  const ts = tiers();
  $('#meter').style.width = ts.length ? Math.min(100, n / ts[ts.length - 1].pecas * 100) + '%' : '0';
  $('#tiers').innerHTML = ts.map((t, i) => `<span class="${t.pecas === n ? 'hit' : ''}">${tierTxt(t, i, ts)}</span>`).join('');
  $('#sNorm').textContent = eurC(norm); $('#sLbl').textContent = r ? `Poupas (-${r}%)` : 'Poupas';
  $('#sSave').textContent = eurC(norm - tot); $('#sTot').textContent = eurC(tot);
  // Cor e tamanho de cada peça escolhidos aqui mesmo (sem sair do simulador).
  for (const p of sel) if (!simSz[p.slug]) simSz[p.slug] = { cor: (p.variantes.find(v => v.disp) || p.variantes[0] || {}).cor || '', tam: '' };
  $('#simSz').innerHTML = sel.map(p => {
    const e = simSz[p.slug], cores = [...new Set(p.variantes.map(v => v.cor).filter(Boolean))];
    const tams = [...new Set(p.variantes.filter(v => !e.cor || v.cor === e.cor).map(v => v.tam).filter(Boolean))].sort(szOrd);
    return `<div class="sp" data-sp="${p.slug}"><div class="sp-h"><b>${esc(p.nome)}</b><span>${esc([e.cor, e.tam && 'Tam. ' + e.tam].filter(Boolean).join(' · ') || 'escolhe o tamanho')}</span></div>
      ${cores.length > 1 ? `<div class="sw">${cores.map(c => `<button class="${c === e.cor ? 'on' : ''}${avail(p, c) ? '' : ' no'}" data-scor="${esc(c)}" aria-label="${esc(c)}" title="${esc(c)}" style="background:${hex(c)}"></button>`).join('')}</div>` : ''}
      ${tams.length ? `<div class="sz">${tams.map(t => `<button data-stam="${esc(t)}" class="${t === e.tam ? 'on' : ''}" ${avail(p, e.cor, t) ? '' : 'disabled'}>${esc(tamN(t))}</button>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
  const falta = sel.filter(p => !simVar(p));
  $('#simAdd').disabled = !n;
  $('#simAdd').textContent = !n ? 'Escolhe pelo menos 1 peça' : falta.length ? (n > 1 ? 'Escolhe o tamanho de cada peça' : 'Escolhe o tamanho') : `Juntar ao saco · ${eurC(tot)}`;
}
// Variante escolhida no simulador (só se tiver cor/tamanho definidos e disponível).
function simVar(p) {
  const e = simSz[p.slug] || {}, temTam = p.variantes.some(v => v.tam);
  if (temTam && !e.tam) return null;
  const v = p.variantes.find(x => (!e.cor || x.cor === e.cor) && (!temTam || x.tam === e.tam));
  return v && v.disp ? v : null;
}
$('#simSz').onclick = ev => {
  const b = ev.target.closest('button'), box = ev.target.closest('[data-sp]'); if (!b || !box || b.disabled) return;
  const p = S.by[box.dataset.sp], e = simSz[p.slug];
  if (b.dataset.scor !== undefined) { e.cor = b.dataset.scor; if (e.tam && !avail(p, e.cor, e.tam)) e.tam = ''; }
  if (b.dataset.stam !== undefined) e.tam = b.dataset.stam;
  simDraw();
};
const simPick = (get, set) => e => { const o = e.target.closest('.sopt'); if (!o) return; const p = S.by[o.dataset.s]; set(get() === p ? null : p); simDraw(); };
$('#tops').onclick = simPick(() => simT, v => simT = v);
$('#bots').onclick = simPick(() => simB, v => simB = v);
$('#simAdd').onclick = () => {
  const sel = [simT, simB].filter(Boolean); if (!sel.length) return;
  const falta = sel.filter(p => !simVar(p));
  if (falta.length) {
    $$('#simSz .sp').forEach(el => el.classList.toggle('falta', falta.some(p => p.slug === el.dataset.sp)));
    $('#simSz .sp.falta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return toast(falta.length > 1 ? 'Escolhe o tamanho de cada peça' : 'Escolhe o tamanho');
  }
  for (const p of sel) {
    const v = simVar(p), it = S.cart.find(i => i.v === v.id), max = Math.min(10, v.stock ?? 10);
    if (it) it.q = Math.min(max, it.q + 1); else S.cart.push({ v: v.id, q: 1 });
  }
  save(); cartUI();
  const nTot = S.cart.reduce((a, i) => a + i.q, 0), r = taxa(nTot);
  toast(`Conjunto no saco${r ? ` · -${r}% em todas as peças` : ''}`);
  setTimeout(() => drawer('#cart', true), 300);
};

/* ---------- filtros e lista ---------- */
function filters() {
  const tipos = S.cats.filter(c => c.grupo === 'tipo'), cols = S.cats.filter(c => c.grupo === 'colecao');
  const chip = (k, v, t) => `<button class="chip${S.F[k] === v ? ' on' : ''}" data-k="${k}" data-v="${esc(v)}">${esc(t)}</button>`;
  $('#cats').innerHTML = chip('cat', '', 'Tudo') + tipos.map(c => chip('cat', c.slug, c.nome)).join('');
  $('#cols').innerHTML = chip('col', '', 'Todas') + cols.map(c => chip('col', c.slug, c.nome)).join('');
  const all = [...new Set(S.prods.flatMap(p => p.variantes.filter(v => v.disp).map(v => tamN(v.tam))).filter(Boolean))].sort(szOrd);
  $('#fsizes').innerHTML = chip('size', '', 'Todos') + all.map(s => chip('size', s, s)).join('');
  $$('.filters .chip').forEach(b => b.onclick = () => { const k = b.dataset.k; S.F[k] = S.F[k] === b.dataset.v ? '' : b.dataset.v; S.shown = 24; filters(); grid(); });
}
function list() {
  const { cat, col, size, q, sort } = S.F, n = q.trim().toLowerCase();
  let L = S.prods.filter(p => (!cat || p.categorias.includes(cat)) && (!col || p.categorias.includes(col)) && (!size || avail(p, '', size)) && (!n || (p.nome + ' ' + p.cores.join(' ')).toLowerCase().includes(n)));
  if (sort === 'asc') L = [...L].sort((a, b) => from(a).c - from(b).c);
  if (sort === 'desc') L = [...L].sort((a, b) => from(b).c - from(a).c);
  if (sort === 'az') L = [...L].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  if (!sort) L = [...L].sort((a, b) => avail(b) - avail(a));
  return L;
}
function card(p, i = 0) {
  const ok = avail(p), cores = p.cores.slice(0, 6), r1 = taxa(1), href = `#p/${p.slug}`;
  return `<article class="card${ok ? '' : ' soldout'}" style="animation-delay:${(i % 24) * 30}ms">
    <div class="ph"><a class="cl" href="${href}" aria-label="${esc(p.nome)}"><img class="a" src="${p.imgs[0]}" alt="${esc(p.nome)}" loading="lazy">${p.imgs[1] ? `<img class="b" src="${p.imgs[1]}" alt="" loading="lazy">` : ''}
      ${ok && maxDesc(p, r1) ? `<span class="disc">-${maxDesc(p, r1)}%</span>` : ''}
      ${!ok ? '<span class="flag dark">Esgotado</span>' : lowStock(p) ? '<span class="flag">Últimas unidades</span>' : p.destaque ? '<span class="tag">Mais procurado</span>' : ''}</a>
      ${ok ? `<button class="qadd" data-q="${p.slug}" aria-label="Adicionar ${esc(p.nome)} ao saco">+</button>` : ''}</div>
    <a class="cb" href="${href}"><div class="ci"><h3>${esc(p.nome)}</h3></div><p class="price">${priceHTML(p)}</p>
      ${cores.length > 1 ? `<div class="dots">${cores.map(c => `<span class="dot" title="${esc(c)}" style="background:${hex(c)}"></span>`).join('')}${p.cores.length > 6 ? ` +${p.cores.length - 6}` : ''}</div>` : ''}
      <div class="szs">${sizes(p).map(s => `<span class="${avail(p, '', s) ? (s === S.F.size ? 'hit' : '') : 'no'}">${esc(s)}</span>`).join('')}</div></a></article>`;
}
function grid() {
  const L = list();
  $('#grid').innerHTML = L.slice(0, S.shown).map(card).join('');
  $('#count').textContent = `${L.length} peça${L.length === 1 ? '' : 's'}${S.F.size ? ` disponíveis no tamanho ${S.F.size}` : ''}`;
  $('#empty').hidden = L.length > 0;
  $('#moreBtn').hidden = L.length <= S.shown;
}
// adicionar rápido (+) nos cartões
document.addEventListener('click', e => {
  const q = e.target.closest('.qadd'); if (!q) return;
  e.preventDefault(); e.stopPropagation();
  const p = S.by[q.dataset.q], av = p.variantes.filter(v => v.disp && (!S.F.size || tamN(v.tam) === S.F.size));
  if (av.length === 1) return add(av[0].id, 1);
  openP(p.slug, S.F.size ? '' : 'Escolhe a cor e o tamanho');
});

/* ---------- página de produto ---------- */
// Galeria: passa sozinha para a foto seguinte (pára com o rato por cima e alguns segundos depois de mexer).
let galPausa = 0;
function galGo(i) {
  const th = $$('#pp .thumbs button'), big = $('#pp .big img'); if (th.length < 2 || !big) return;
  P.i = (i + th.length) % th.length;
  th.forEach((b, k) => b.classList.toggle('on', k === P.i));
  big.src = th[P.i].querySelector('img').src;
  big.style.animation = 'none'; void big.offsetWidth; big.style.animation = '';
  const t = th[P.i], box = t.parentElement, tr = t.getBoundingClientRect(), br = box.getBoundingClientRect();
  // Só mexe na coluna de miniaturas se a miniatura ativa estiver fora de vista (sem saltos).
  const dy = tr.top < br.top ? tr.top - br.top : tr.bottom > br.bottom ? tr.bottom - br.bottom : 0;
  const dx = tr.left < br.left ? tr.left - br.left : tr.right > br.right ? tr.right - br.right : 0;
  if (dy || dx) box.scrollBy({ top: dy, left: dx, behavior: 'smooth' });
  const nx = th[(P.i + 1) % th.length].querySelector('img'); if (nx) new Image().src = nx.src;
}
const galHover = matchMedia('(hover:hover)');
setInterval(() => {
  if ($('#pp').hidden || document.hidden || Date.now() < galPausa) return;
  if (galHover.matches && $('#pp .gal')?.matches(':hover')) return;
  galGo(P.i + 1);
}, 3500);
// Telemóvel: arrastar a foto grande para o lado muda de foto.
let galX = null;
document.addEventListener('touchstart', e => { galX = e.target.closest('#pp .big') ? e.touches[0].clientX : null; }, { passive: true });
document.addEventListener('touchend', e => {
  if (galX === null) return; const dx = e.changedTouches[0].clientX - galX; galX = null;
  galPausa = Date.now() + 8000; if (Math.abs(dx) > 40) galGo(P.i + (dx < 0 ? 1 : -1));
}, { passive: true });
const P = { p: null, cor: '', tam: '', q: 1, i: 0, note: '' };
function openP(slug, note = '') { S.note = note; S.expect = slug; if (location.hash !== '#p/' + slug) location.hash = 'p/' + slug; else route(); }
function route() {
  const m = location.hash.match(/^#p\/(.+)$/), p = m && S.by[decodeURIComponent(m[1])];
  document.body.classList.toggle('on-pp', !!p);
  $('#home').hidden = !!p; $('#pp').hidden = !p;
  if (p) {
    if (P.p !== p) {
      Object.assign(P, { p, cor: (p.variantes.find(v => v.disp) || p.variantes[0] || {}).cor || '', tam: '', q: 1, i: 0, note: S.note });
      if (S.expect !== p.slug) S.queue = [];
      S.note = ''; S.expect = '';
    }
    pp(); scrollTo(0, 0); document.title = `${p.nome} · Incomum.eu`;
  } else {
    P.p = null; S.queue = []; document.title = 'Incomum.eu · LIVE! original em Portugal';
    const ob = location.hash.match(/^#obrigado\/(cs_\w+)$/);
    if (ob) return location.replace('obrigado.html?s=' + ob[1]);
    if (location.hash === '#saco') { history.replaceState(null, '', location.pathname); return drawer('#cart', true); }
    const el = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) el.scrollIntoView();
  }
}
function pp() {
  const p = P.p, cores = [...new Set(p.variantes.map(v => v.cor).filter(Boolean))];
  const vImg = (p.variantes.find(v => v.cor === P.cor && v.img) || {}).img;
  const imgs = [...new Set([vImg, ...((p.fotos && p.fotos[P.cor]) || p.imgs)].filter(Boolean))];
  if (P.i >= imgs.length) P.i = 0;
  const tams = [...new Set(p.variantes.filter(v => !P.cor || v.cor === P.cor).map(v => v.tam).filter(Boolean))].sort(szOrd);
  const sel = p.variantes.find(v => (!cores.length || v.cor === P.cor) && (!tams.length || v.tam === P.tam));
  const need = tams.length && !P.tam;
  const cat = S.cats.find(c => c.grupo === 'tipo' && p.categorias.includes(c.slug));
  const r1 = taxa(1), n = S.cart.reduce((a, i) => a + i.q, 0);
  let hint = '';
  if (r1) { const after = n + 1, ra = taxa(after), nx = tiers().find(t => t.pecas > after);
    if (ra > r1) hint = `Com ${after} peças no saco pagas <b>-${ra}%</b> em todas.`;
    else if (nx) hint = `Leva ${nx.pecas} peças e paga <b>-${nx.pct}%</b> em todas.`; }
  let msg = '', cls = '';
  if (!avail(p)) { msg = 'Esgotado de momento. Pergunta-nos quando volta.'; cls = 'no'; }
  else if (sel && !sel.disp) { msg = 'Esgotado nesta combinação.'; cls = 'no'; }
  else if (sel) { const lo = typeof sel.stock === 'number' && sel.stock <= 2; msg = lo ? '● Últimas unidades' : '● Disponível'; cls = lo ? 'low' : ''; }
  const x = from(p);
  $('#pp').innerHTML = `<div class="wrap">
    <div class="crumbs"><a href="#loja">Coleção</a>${cat ? `<span>/</span><a href="#loja" data-cat="${cat.slug}">${esc(cat.nome)}</a>` : ''}</div>
    <div class="pd">
      <div class="gal"><div class="thumbs">${imgs.map((u, i) => `<button class="${i === P.i ? 'on' : ''}" data-i="${i}" aria-label="Foto ${i + 1}"><img src="${u}" alt="" loading="lazy"></button>`).join('')}</div>
        <div class="big"><img src="${imgs[P.i]}" alt="${esc(p.nome)}"></div></div>
      <div class="info">
        ${P.note ? `<span class="pill">${esc(P.note)}</span>` : '<p class="eyebrow">LIVE! · Original</p>'}
        <h1>${esc(p.nome)}</h1>
        <p class="price">${sel ? fmtFS(unit(sel, r1), Math.round(sel.preco * 100), pctV(sel, r1)) : priceHTML(p)}</p>${(() => { const x = sel ? { f: unit(sel, r1), s: Math.round(sel.preco * 100) } : from(p); return x.s && x.s > x.f ? `<p class="psave">Poupas ${eurC(x.s - x.f)}</p>` : ''; })()}
        ${hint ? `<p class="hint">${hint}</p>` : ''}
        <p class="note">IVA incluído · Envio ${eur(S.portes.valor)} para Portugal continental, ${S.portes.prazo}</p>
        ${cores.length ? `<div class="opt"><div class="opt-h">Cor <span>${esc(P.cor)}</span></div><div class="sw">${cores.map(c => `<button class="${c === P.cor ? 'on' : ''}${avail(p, c) ? '' : ' no'}" data-cor="${esc(c)}" title="${esc(c)}" aria-label="${esc(c)}" style="background:${hex(c)}"></button>`).join('')}</div></div>` : ''}
        ${tams.length ? `<div class="opt"><div class="opt-h">Tamanho <span>${P.tam ? esc(P.tam) : 'escolhe o teu'}</span></div><div class="sz">${tams.map(t => `<button data-tam="${esc(t)}" class="${t === P.tam ? 'on' : ''}" ${avail(p, P.cor, t) ? '' : 'disabled'}>${esc(tamN(t))}</button>`).join('')}</div></div>` : ''}
        <div class="stockmsg ${cls}">${msg}</div>
        <div class="buy"><div class="qty"><button data-q="-1" aria-label="Menos">−</button><span>${P.q}</span><button data-q="1" aria-label="Mais">+</button></div>
          <button class="btn${avail(p) && !need ? ' grad' : ''}" id="addBtn" ${!avail(p) ? 'disabled' : ''}>${!avail(p) ? 'Esgotado' : need ? 'Escolhe o tamanho' : 'Adicionar ao saco'}</button></div>
        <a class="btn ghost ask" href="${wa(`Olá Incomum! Estou a ver *${p.nome}*${P.cor ? ' (' + P.cor + ')' : ''} no site. Que tamanho me aconselham?`)}" target="_blank" rel="noopener">Dúvidas de tamanho? WhatsApp</a>
        <div class="assure">
          <div><svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>Revendedor autorizado LIVE! em Portugal</div>
          <div><svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/></svg>Envio para Portugal continental · ${S.portes.prazo}</div>
          <div><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/></svg>14 dias para devolver (livre resolução)</div>
        </div>
        ${p.descricao ? `<div class="desc"><h4>Detalhes</h4>${esc(p.descricao)}</div>` : ''}
      </div>
    </div>
    <div class="sec"><div class="sh"><div><p class="eyebrow">Combina com</p><h2>Também vais gostar</h2></div></div><div class="related">${related(p).slice(0, 4).map(card).join('')}</div></div>
  </div>`;
  $$('#pp .thumbs button').forEach(b => b.onclick = () => { galPausa = Date.now() + 8000; P.i = +b.dataset.i; pp(); });
  $$('#pp [data-cor]').forEach(b => b.onclick = () => { P.cor = b.dataset.cor; P.i = 0; if (P.tam && !avail(p, P.cor, P.tam)) P.tam = ''; pp(); });
  $$('#pp [data-tam]').forEach(b => b.onclick = () => { P.tam = b.dataset.tam; pp(); });
  $$('#pp [data-q]:not(.qadd)').forEach(b => b.onclick = () => { P.q = Math.max(1, Math.min(10, P.q + +b.dataset.q)); pp(); });
  $$('#pp .crumbs [data-cat]').forEach(a => a.onclick = () => { S.F.cat = a.dataset.cat; filters(); grid(); });
  $('#addBtn').onclick = () => {
    if (need) { $('.sz').animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 260 }); toast('Escolhe primeiro o tamanho'); return; }
    if (!sel || !sel.disp) return toast('Esta combinação está esgotada');
    const q = P.q; P.q = 1; add(sel.id, q); if (!S.queue.length) pp();
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
  save(); cartUI();
  const n = S.cart.reduce((a, i) => a + i.q, 0), r = taxa(n), nx = tiers().find(t => t.pecas > n);
  toast(`Adicionado ao saco${nx ? ` · junta mais ${nx.pecas - n} peça${nx.pecas - n > 1 ? 's' : ''} e ficas com -${nx.pct}%` : r ? ` · tens o desconto máximo de -${r}%` : ''}`);
  const b = $('#badge'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  if (S.queue.length) { const nxt = S.queue.shift(); setTimeout(() => openP(nxt, 'Agora a parte de baixo'), 450); }
  else setTimeout(() => drawer('#cart', true), 350);
}
// Mesma conta do servidor, em cêntimos: escalão pelo nº total de peças, aplicado a todas, preço unitário arredondado ao cêntimo.
function totals() {
  const n = S.cart.reduce((a, i) => a + i.q, 0), r = taxa(n);
  let bruto = 0, liq = 0;
  for (const i of S.cart) { const v = S.byVar[i.v].v; bruto += cent(v) * i.q; liq += unit(v, r) * i.q; }
  // cupão: % em cada peça (já com promoções) e/ou envio grátis; respeita a compra mínima
  const cup = S.cupao, cupOn = !!(cup && n && (!cup.minimo || liq >= cup.minimo));
  let cdesc = 0;
  if (cupOn && cup.pct) { let l2 = 0; for (const i of S.cart) { const v = S.byVar[i.v].v; l2 += Math.round(unit(v, r) * (100 - cup.pct) / 100) * i.q; } cdesc = liq - l2; liq = l2; }
  const portes = n && !(cupOn && cup.portes_gratis) ? PORTES() : 0;
  return { n, r, bruto, desc: bruto - liq - cdesc, liq, portes, tot: liq + portes, cup, cupOn, cdesc };
}
function cartUI() {
  const T = totals(), n = T.n, b = $('#badge'), ts = tiers(), last = ts[ts.length - 1];
  b.hidden = !n; b.textContent = n;
  const nx = ts.find(t => t.pecas > n);
  $('#ship').classList.toggle('g', !!(n && last));
  $('#ship').innerHTML = !n ? '' : last
    ? `<div class="goal"><span>${nx ? `Junta mais ${nx.pecas - n} peça${nx.pecas - n > 1 ? 's' : ''} e ficas com <b>-${nx.pct}%</b> em tudo` : `Tens o desconto máximo: <b>-${T.r}%</b> em tudo ✦`}</span><div class="meter"><i style="width:${Math.min(100, n / last.pecas * 100)}%"></i></div></div>`
    : `Envio para <b>Portugal continental</b> · entrega ${S.portes.prazo}`;
  $('#ship').hidden = !n;
  $('#items').innerHTML = !n ? `<div class="cempty"><p>O teu saco está vazio.</p><a class="btn" href="#loja" data-close>Ver a coleção</a></div>` :
    S.cart.map((i, k) => { const { p, v } = S.byVar[i.v], c = cent(v), u = unit(v, T.r), falta = typeof v.stock === 'number' && i.q > v.stock;
      return `<div class="it"><a href="#p/${p.slug}" data-close><img src="${v.img || p.imgs[0]}" alt=""></a>
      <div><h4>${esc(p.nome)}</h4><small>${[v.cor, v.tam && 'Tam. ' + v.tam].filter(Boolean).map(esc).join(' · ')}</small>
      ${falta ? `<div class="err">${v.stock > 0 ? 'Stock insuficiente: reduz a quantidade' : 'Esgotou entretanto'}</div>` : ''}
      <div class="qty"><button data-k="${k}" data-d="-1" aria-label="Menos">−</button><span>${i.q}</span><button data-k="${k}" data-d="1" aria-label="Mais">+</button></div></div>
      <div class="r"><span>${eurC(u * i.q)}${T.r ? `<s>${eurC(c * i.q)}</s>` : ''}</span><button class="rm" data-rm="${k}">Remover</button></div></div>`; }).join('');
  $('#cfoot').innerHTML = !n ? '' : `<div class="ln"><span>Subtotal (${n} peça${n === 1 ? '' : 's'})</span><span>${eurC(T.bruto)}</span></div>
    ${T.r ? `<div class="ln save"><span>${esc(camp().nome)} -${T.r}%</span><span>-${eurC(T.desc)}</span></div>` : ''}
    ${T.cdesc ? `<div class="ln save"><span>Cupão ${esc(T.cup.nome)} -${T.cup.pct}%</span><span>-${eurC(T.cdesc)}</span></div>` : ''}
    <div class="ln${T.cupOn && T.cup.portes_gratis ? ' save' : ''}"><span>Envio Portugal continental${T.cupOn && T.cup.portes_gratis ? ` · cupão ${esc(T.cup.nome)}` : ''}</span><span>${T.portes ? eurC(T.portes) : 'Grátis'}</span></div>
    <div class="cupao">${T.cup ? `<span class="cup-ok${T.cupOn ? '' : ' falta'}">${T.cupOn ? `✓ Cupão <b>${esc(T.cup.nome)}</b>: ${esc(cupaoTexto(T.cup))}` : `Cupão <b>${esc(T.cup.nome)}</b>: faltam ${eurC(T.cup.minimo - T.liq)} para usar (compra mínima ${eurC(T.cup.minimo)})`}</span><button class="cup-x" id="cupX">Remover</button>`
      : `<input id="cupIn" placeholder="Tens um cupão?" autocomplete="off" autocapitalize="characters"><button class="btn line" id="cupOk">Aplicar</button>`}</div>
    <div class="cup-err" id="cupErr" hidden></div>
    <div class="ln tot"><span>Total</span><span>${eurC(T.tot)}</span></div>
    <button class="btn block grad" id="checkout">Finalizar compra</button>
    <p class="paynote">Pagamento seguro com cartão ou MB WAY · IVA incluído<br>Ao continuar aceitas os <a href="termos.html" style="text-decoration:underline">termos de venda</a></p>`;
  $$('#items [data-d]').forEach(x => x.onclick = () => { const i = S.cart[+x.dataset.k], max = Math.min(10, S.byVar[i.v].v.stock ?? 10); i.q += +x.dataset.d; if (i.q < 1) S.cart.splice(+x.dataset.k, 1); else i.q = Math.min(max, i.q); save(); cartUI(); if (P.p) pp(); });
  $$('#items [data-rm]').forEach(x => x.onclick = () => { S.cart.splice(+x.dataset.rm, 1); save(); cartUI(); if (P.p) pp(); });
  $$('#cart [data-close]').forEach(x => x.addEventListener('click', () => drawer('#cart', false)));
  const c = $('#checkout'); if (c) c.onclick = checkout;
  const setCup = c => { S.cupao = c; guardarCupao(c); };
  const ap = async () => {
    const v = $('#cupIn').value.trim(); if (!v) return;
    const b = $('#cupOk'); b.disabled = true; b.textContent = 'A verificar…';
    const c = await validarCupao(v);
    if (c.ok) { setCup(c); cartUI(); toast(`Cupão aplicado: ${cupaoTexto(c)}`); }
    else { b.disabled = false; b.textContent = 'Aplicar'; $('#cupErr').textContent = c.erro || 'Este cupão não existe.'; $('#cupErr').hidden = false; }
  };
  if ($('#cupOk')) { $('#cupOk').onclick = ap; $('#cupIn').onkeydown = e => { if (e.key === 'Enter') ap(); }; $('#cupIn').oninput = () => { $('#cupErr').hidden = true; }; }
  if ($('#cupX')) $('#cupX').onclick = () => { setCup(null); cartUI(); };
}
// Etapa 2: com CFG.checkoutUrl definido, o servidor valida preços/stock e devolve o link do Stripe Checkout.
async function checkout() {
  if (CFG.checkoutUrl && CFG.stripeChave) { save(); location.href = 'checkout.html'; return; }
  // Ainda sem pagamentos online: encomenda pelo WhatsApp com o resumo do saco.
  const T = totals(), r = T.r;
  const linhas = S.cart.map(i => { const { p, v } = S.byVar[i.v]; return `• ${i.q}× ${p.nome}${v.cor ? ' · ' + v.cor : ''}${v.tam ? ' · ' + v.tam : ''} — ${eurC(unit(v, r) * i.q)}`; });
  open(wa(`Olá! Quero encomendar:\n${linhas.join('\n')}\n${r ? `Desconto: -${r}%\n` : ''}Envio: ${eurC(T.portes)}\nTotal: ${eurC(T.tot)}`), '_blank', 'noopener');
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

/* ---------- animações de entrada e cabeçalho ---------- */
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .12 }) : null;
function observe() { $$('.reveal:not(.in)').forEach(el => io ? io.observe(el) : el.classList.add('in')); }
addEventListener('scroll', () => $('.hd').classList.toggle('sc', scrollY > 10), { passive: true });

/* ---------- vídeo do topo: reel + fundo desfocado (só desktop), pausa fora do ecrã e com "reduzir movimento" ---------- */
(() => {
  const hero = $('.hero'), v = $('#heroVid'), pp = $('#reelPP'), bg = $('.hero-bg');
  if (!hero || !v) return;
  let parado = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (bg && matchMedia('(min-width: 901px)').matches && !parado) { bg.src = bg.dataset.src; bg.preload = 'auto'; bg.play().catch(() => {}); }
  else if (bg) bg.remove();
  const vids = [v, bg].filter(Boolean);
  const sync = () => { pp.textContent = parado ? '▶' : '❚❚'; pp.setAttribute('aria-label', parado ? 'Ver vídeo' : 'Pausar vídeo'); };
  const tocar = on => vids.forEach(x => on ? x.play().catch(() => {}) : x.pause());
  if (parado) { v.removeAttribute('autoplay'); v.pause(); }
  pp.onclick = () => { parado = !parado; tocar(!parado); sync(); };
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => tocar(e.isIntersecting && !parado)).observe(hero);
  sync();
})();

setTimeout(() => document.body.classList.add('ready'), 3000); // segurança: nunca deixa o texto do topo escondido
load().catch(() => { document.body.classList.add('ready'); $('#grid').innerHTML = '<p>Não foi possível carregar a coleção. Atualiza a página.</p>'; });
