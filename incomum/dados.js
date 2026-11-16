/* Catálogo vivo: produtos, variantes e categorias vêm da base de dados (o painel edita-os).
   Se a base de dados não responder, usa o catalogo.json como reserva.
   Devolve sempre o mesmo formato: { produtos, categorias, portes }. */
const PORTES_PADRAO = { valor: 7, gratis: 100, dias: 2, nome: 'Envio Portugal continental', prazo: 'entrega em 48h' };
// envio vem do painel (tabela incomum_loja): valor, grátis a partir de, prazo
const portesDe = l => l ? { valor: l.portes / 100, gratis: l.portes_gratis_acima ? l.portes_gratis_acima / 100 : null, dias: l.prazo_dias, nome: 'Envio Portugal continental', prazo: l.prazo_dias <= 2 ? 'entrega em 48h' : `entrega até ${l.prazo_dias} dias úteis` } : PORTES_PADRAO;

async function catalogoVivo(prefixo = '') {
  const C = window.INCOMUM || {};
  try {
    if (!C.supabaseUrl) throw new Error('sem base de dados');
    const h = { headers: { apikey: C.supabaseChave } };
    const sel = 'id,slug,nome,descricao,categorias,fotos,destaque,ordem,variantes:incomum_variantes(id,cor,tam,preco,promo,desconto,stock,na_campanha,pct_campanha)';
    const [rp, rc, rl] = await Promise.all([
      fetch(`${C.supabaseUrl}/rest/v1/incomum_produtos?select=${sel}&ativo=eq.true&order=ordem&limit=2000`, h),
      fetch(`${C.supabaseUrl}/rest/v1/incomum_categorias?select=slug,nome,grupo,parte,ordem&ativo=eq.true&order=ordem`, h),
      fetch(`${C.supabaseUrl}/rest/v1/incomum_loja?select=portes,portes_gratis_acima,prazo_dias&id=eq.1`, h).catch(() => null),
    ]);
    if (!rp.ok || !rc.ok) throw new Error('resposta ' + rp.status);
    const linhas = await rp.json(), cats = await rc.json();
    if (!linhas.length) throw new Error('sem produtos');
    const url = u => { u = String(u || ''); if (/["'<>\s]/.test(u) || /^[a-z]+:/i.test(u) && !/^https:/i.test(u)) return ''; return /^https:/i.test(u) ? u : prefixo + u; };
    const produtos = linhas.map(p => {
      const fotos = (Array.isArray(p.fotos) ? p.fotos : []).filter(f => f && f.url);
      const imgs = fotos.map(f => url(f.url));
      const cores = [...new Set(p.variantes.map(v => v.cor).filter(Boolean))];
      const soltas = fotos.filter(f => !f.cor).map(f => url(f.url));
      const porCor = {};
      for (const k of cores) { const l = fotos.filter(f => f.cor === k).map(f => url(f.url)); porCor[k] = l.length ? l : soltas; }
      const variantes = p.variantes.map(v => ({
        id: v.id, cor: v.cor || '', tam: v.tam || '', preco: v.preco / 100, promo: v.promo ? v.promo / 100 : null,
        desconto: v.desconto || 0, camp: v.na_campanha !== false, pc: v.pct_campanha || 0, stock: v.stock, disp: v.stock > 0, img: (porCor[v.cor] || [])[0] || null,
      }));
      const tamanhos = [...new Set(variantes.map(v => v.tam).filter(Boolean))];
      const ps = variantes.filter(v => v.disp).map(v => (v.promo && v.promo < v.preco ? v.promo : v.preco));
      return {
        id: p.id, slug: p.slug, nome: p.nome, descricao: p.descricao || '', categorias: p.categorias || [], imgs, cores, tamanhos,
        preco: ps.length ? Math.min(...ps) : (variantes[0] ? variantes[0].preco : 0), variantes, ordem: p.ordem, destaque: !!p.destaque,
        fotos: cores.length > 1 ? porCor : null,
      };
    }).filter(p => p.variantes.length);
    const categorias = cats.map(c => ({ ...c, total: produtos.filter(p => p.categorias.includes(c.slug)).length }));
    let loja = null; try { if (rl && rl.ok) loja = (await rl.json())[0] || null; } catch {}
    return { produtos, categorias, portes: portesDe(loja), vivo: true };
  } catch (e) {
    console.warn('Catálogo de reserva:', e && e.message);
    const c = await (await fetch(prefixo + 'catalogo.json?v=cor4')).json();
    c.portes = c.portes || PORTES_PADRAO;
    for (const k of c.categorias) if (!('parte' in k)) k.parte = k.slug === 'tops-croppeds-camisolas' ? 'cima' : ['leggings-calcas', 'shorts-bermudas'].includes(k.slug) ? 'baixo' : null;
    return c;
  }
}

// Cupões: criados no painel (tabela incomum_cupoes). A loja só pergunta se um código vale; o servidor confirma sempre no pagamento.
const normCupao = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function validarCupao(codigo) {
  const C = window.INCOMUM || {};
  try {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/rpc/incomum_cupao`, {
      method: 'POST', headers: { apikey: C.supabaseChave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_codigo: String(codigo || '').slice(0, 40) }),
    });
    const j = await r.json();
    return j && typeof j === 'object' ? j : { ok: false, erro: 'Não foi possível verificar o cupão.' };
  } catch { return { ok: false, erro: 'Não foi possível verificar o cupão. Tenta de novo.' }; }
}
const cupaoGuardado = () => { try { const j = JSON.parse(localStorage.getItem('incomum-cupao') || 'null'); return j && j.codigo ? j : null; } catch { return null; } };
const guardarCupao = c => { try { c ? localStorage.setItem('incomum-cupao', JSON.stringify(c)) : localStorage.removeItem('incomum-cupao'); } catch {} };
const cupaoTexto = c => [c.pct ? `-${c.pct}% em tudo` : '', c.portes_gratis ? 'envio grátis' : ''].filter(Boolean).join(' + ');
const eurCup = c => (c / 100).toFixed(2).replace('.', ',') + '\u00a0€';

// Textos do envio (valor, grátis a partir de, prazo) vêm do painel > Cupões e envio. Preenche os elementos [data-env].
let ENVIO = PORTES_PADRAO;
const eurE = n => (Math.round(n * 100) % 100 ? n.toFixed(2).replace('.', ',') : String(Math.round(n))) + '\u00a0€';
function pintarEnvio(p) {
  ENVIO = p || ENVIO;
  const v = eurE(ENVIO.valor), g = ENVIO.gratis ? eurE(ENVIO.gratis) : '', pz = ENVIO.prazo, Pz = pz.charAt(0).toUpperCase() + pz.slice(1);
  const dias = ENVIO.dias <= 2 ? 'até 2 dias úteis (48h)' : `até ${ENVIO.dias} dias úteis`;
  const T = {
    aviso: g ? `Envio grátis a partir de ${g} · ${pz}` : `Envio ${v} para Portugal continental · ${pz}`,
    titulo: g ? `Envio grátis a partir de ${g}` : `Envio ${v}`,
    sub: g ? `Abaixo disso, ${v} · Portugal continental · ${pz}` : `Portugal continental · ${pz}`,
    nota: `Mais envio de ${v} para Portugal continental${g ? ` (grátis a partir de ${g})` : ''}.`,
    passo: `Envio ${v} para Portugal continental${g ? `, grátis a partir de ${g}` : ''} · ${pz}. 14 dias para devolver.`,
    prazo: Pz,
    termos1: `O envio custa <b>${v}</b> por encomenda${g ? `; é <b>grátis</b> em encomendas a partir de <b>${g}</b>` : ''}.`,
    termos2: `A entrega é feita em <b>${dias}</b> depois de o pagamento estar confirmado.`,
  };
  document.querySelectorAll('[data-env]').forEach(el => { const t = T[el.dataset.env]; if (t != null) el.innerHTML = t; });
}
// páginas sem catálogo (termos, conta, obrigado): pergunta só o envio
async function envioDaLoja() {
  const C = window.INCOMUM || {};
  try {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/incomum_loja?select=portes,portes_gratis_acima,prazo_dias&id=eq.1`, { headers: { apikey: C.supabaseChave } });
    const l = r.ok ? (await r.json())[0] : null; pintarEnvio(portesDe(l));
  } catch { pintarEnvio(); }
}
