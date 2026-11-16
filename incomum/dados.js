/* Catálogo vivo: produtos, variantes e categorias vêm da base de dados (o painel edita-os).
   Se a base de dados não responder, usa o catalogo.json como reserva.
   Devolve sempre o mesmo formato: { produtos, categorias, portes }. */
const PORTES_PADRAO = { valor: 10, nome: 'Envio Portugal continental', prazo: 'até 7 dias úteis' };

async function catalogoVivo(prefixo = '') {
  const C = window.INCOMUM || {};
  try {
    if (!C.supabaseUrl) throw new Error('sem base de dados');
    const h = { headers: { apikey: C.supabaseChave } };
    const sel = 'id,slug,nome,descricao,categorias,fotos,destaque,ordem,variantes:incomum_variantes(id,cor,tam,preco,promo,desconto,stock)';
    const [rp, rc] = await Promise.all([
      fetch(`${C.supabaseUrl}/rest/v1/incomum_produtos?select=${sel}&ativo=eq.true&order=ordem&limit=2000`, h),
      fetch(`${C.supabaseUrl}/rest/v1/incomum_categorias?select=slug,nome,grupo,parte,ordem&ativo=eq.true&order=ordem`, h),
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
        desconto: v.desconto || 0, stock: v.stock, disp: v.stock > 0, img: (porCor[v.cor] || [])[0] || null,
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
    return { produtos, categorias, portes: PORTES_PADRAO, vivo: true };
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
const eurCup = c => (c / 100).toFixed(2).replace('.', ',') + ' €';
