/* Incomum.eu — código comum às páginas de pagamento, obrigado e conta */
const CFG = window.INCOMUM || {};
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eur = c => ((c || 0) / 100).toFixed(2).replace('.', ',') + '\u00a0€'; // cêntimos
const dataPT = d => d ? new Date(d).toLocaleString('pt-PT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
const waLink = t => `https://wa.me/${CFG.whatsapp || '351910202105'}?text=${encodeURIComponent(t)}`;
const desc = i => [i.cor, i.tam && 'Tam. ' + i.tam].filter(Boolean).map(esc).join(' · ');

const Saco = {
  ler() { try { return JSON.parse(localStorage.getItem('incomum-saco') || '[]'); } catch { return []; } },
  limpar() { try { localStorage.setItem('incomum-saco', '[]'); } catch { /* sem armazenamento */ } },
};

// Catálogo (fotos e nomes) + preço e stock reais da base de dados.
async function catalogo() {
  const c = await catalogoVivo();
  const porVar = {};
  for (const p of c.produtos) for (const v of p.variantes) {
    porVar[v.id] = { p, v, img: v.img || p.imgs[0] || '', preco: Math.round(v.preco * 100), promo: v.promo ? Math.round(v.promo * 100) : null, desconto: v.desconto || 0, camp: v.camp !== false, pc: v.pc || 0, stock: typeof v.stock === 'number' ? v.stock : (v.disp ? 1 : 0) };
  }
  return { portes: c.portes, porVar };
}
// Campanha ativa (ex.: Black Friday): desconto pelo nº total de peças. O servidor faz a mesma conta.
async function campanha() {
  try {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/incomum_campanha?select=ativa,nome,fim,escaloes`, { headers: { apikey: CFG.supabaseChave } });
    const c = r.ok ? (await r.json())[0] : null;
    return c && c.ativa && Date.now() < new Date(c.fim).getTime() ? c : null;
  } catch { return null; }
}
const pctPara = (c, n) => (c?.escaloes || []).reduce((r, t) => n >= t.pecas ? Math.max(r, t.pct) : r, 0);
const precoDe = x => (x.promo && x.promo < x.preco ? x.promo : x.preco);

async function rpc(nome, corpo) {
  const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: { apikey: CFG.supabaseChave, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error('rpc');
  return r.json();
}

// Seguimento da transportadora (o número é escrito no painel ao enviar).
const segURL = (t, c) => t === 'CTT'
  ? `https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${encodeURIComponent(c)}`
  : `https://t.17track.net/pt#nums=${encodeURIComponent(c)}`;
const segHTML = e => e.seguimento
  ? `<span class="tl-seg">${esc(e.transportadora || 'Transportadora')} · ${esc(e.seguimento)} · <a href="${segURL(e.transportadora, e.seguimento)}" target="_blank" rel="noopener">Seguir envio</a></span>`
  : '';

// Linha do tempo da encomenda: Paga → Em preparação → Enviada → Entregue.
const PASSOS = [
  ['paga', 'Paga', 'pago_em', 'Pagamento confirmado'],
  ['preparacao', 'Em preparação', 'preparacao_em', 'A Incomum está a separar as tuas peças'],
  ['enviada', 'Enviada', 'enviado_em', 'A caminho da tua morada'],
  ['entregue', 'Entregue', 'entregue_em', 'Boa utilização!'],
];
function linhaTempo(e) {
  if (e.estado === 'cancelada') return '<div class="tl-cancel">Esta encomenda foi cancelada. Se já tinhas pago, o reembolso é feito para o mesmo meio de pagamento.</div>';
  const k = PASSOS.findIndex(p => p[0] === e.estado);
  return `<ol class="tl">${PASSOS.map(([id, nome, col, txt], i) => {
    const feito = i <= k, atual = i === k;
    const quando = e[col] || (feito && i === 0 ? e.criado : null);
    return `<li class="${feito ? 'feito' : ''}${atual ? ' atual' : ''}">
      <span class="tl-dot">${feito ? '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>' : ''}</span>
      <span class="tl-txt"><b>${nome}</b><small>${feito ? (quando ? dataPT(quando) : txt) : atual ? txt : i === 3 ? (ENVIO.dias <= 2 ? 'Em 48h (dias úteis) depois de paga' : `Até ${ENVIO.dias} dias úteis depois de paga`) : '&nbsp;'}</small>${id === 'enviada' && feito ? segHTML(e) : ''}</span>
    </li>`;
  }).join('')}</ol>`;
}
function itensHTML(itens, porVar) {
  return `<ul class="lista">${itens.map(i => {
    const x = porVar[i.variante || i.variante_id];
    return `<li><span class="lf">${x?.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : ''}<em>${i.qtd}</em></span>
      <span class="ln"><b>${esc(i.produto)}</b><small>${desc(i)}</small></span>
      <span class="lp">${eur(i.preco * i.qtd)}</span></li>`;
  }).join('')}</ul>`;
}
function totaisHTML(e) {
  return `<div class="tots">
    <div><span>Subtotal</span><span>${eur(e.subtotal)}</span></div>
    ${e.desconto > 0 ? `<div class="poup"><span>Inclui ${esc(e.campanha || 'desconto')} −${e.desconto_pct}%</span><span>poupas ${eur(e.desconto)}</span></div>` : ''}
    ${e.cupDesc > 0 ? `<div class="poup"><span>Cupão ${esc(e.cupNome)} −${e.cupPct}%</span><span>−${eur(e.cupDesc)}</span></div>` : ''}
    <div><span>Envio Portugal continental${e.cupao && !e.portes ? ` · cupão ${esc(e.cupao)}` : ''}</span><span>${e.portes ? eur(e.portes) : '<b class="gratis">Grátis</b>'}</span></div>
    <div class="t"><span>Total</span><span>${eur(e.total)}</span></div>
    <p class="iva">IVA incluído</p></div>`;
}
