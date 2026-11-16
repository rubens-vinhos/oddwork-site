/* Página de pagamento: resumo do carrinho + Stripe Embedded Checkout */
(async () => {
  const saco = Saco.ler();
  const erro = (html, voltar = true) => {
    $('#checkout').innerHTML = '';
    $('#erro').innerHTML = html + (voltar ? '<a class="btn" href="./#saco">Voltar ao carrinho</a>' : '');
    $('#erro').hidden = false;
  };
  $('#resTog').onclick = () => {
    const ab = $('#res').classList.toggle('aberto');
    $('#resTog').setAttribute('aria-expanded', ab);
  };

  if (!saco.length) {
    $('#itens').innerHTML = '';
    $('#res').hidden = true;
    return erro('<b>O teu carrinho está vazio.</b><p>Escolhe as tuas peças e volta aqui para pagar.</p><a class="btn" href="./#loja">Ver a coleção</a>', false);
  }

  // 1. Resumo com preços e stock reais.
  let cat;
  const camp = campanha();
  try { cat = await catalogo(); } catch { return erro('<b>Não foi possível carregar o resumo.</b><p>Verifica a ligação e atualiza a página.</p>'); }
  const linhas = saco.filter(i => cat.porVar[i.v]).map(i => {
    const x = cat.porVar[i.v];
    return { variante: i.v, qtd: i.q, produto: x.p.nome, cor: x.v.cor, tam: x.v.tam, preco: precoDe(x), dv: x.desconto || 0, nc: x.camp !== false, pcp: x.pc || 0, stock: x.stock };
  });
  const n = linhas.reduce((a, l) => a + l.qtd, 0);
  const c = await camp, pct = pctPara(c, linhas.reduce((a, l) => a + (l.nc ? l.qtd : 0), 0));   // só peças da campanha contam
  const original = linhas.reduce((a, l) => a + l.preco * l.qtd, 0);
  // igual ao servidor: em cada peça conta o maior entre o desconto da campanha e o da própria variante (cor + tamanho)
  for (const l of linhas) { l.pcamp = c && l.nc ? Math.max(pct, l.pcp) : 0; const p = Math.max(l.pcamp, l.dv); if (p) l.preco = Math.round(l.preco * (100 - p) / 100); }
  const pctMax = Math.max(...linhas.map(l => Math.max(l.pcamp, l.dv)));
  const antesCupao = linhas.reduce((a, l) => a + l.preco * l.qtd, 0);
  // cupão guardado no carrinho: confirma de novo (pode ter acabado) e aplica igual ao servidor
  let cup = cupaoGuardado();
  if (cup) { const c2 = await validarCupao(cup.codigo); cup = c2.ok ? c2 : null; guardarCupao(cup); }
  if (cup && cup.minimo && antesCupao < cup.minimo) cup = null;
  for (const l of linhas) l.pa = l.preco;               // preço antes do cupão (para mostrar)
  if (cup?.pct) for (const l of linhas) l.preco = Math.round(l.preco * (100 - cup.pct) / 100);
  const subtotal = linhas.reduce((a, l) => a + l.preco * l.qtd, 0);
  pintarEnvio(cat.portes);
  const gAcima = cat.portes?.gratis ? Math.round(cat.portes.gratis * 100) : 0;
  const portes = cup?.portes_gratis || (gAcima && subtotal >= gAcima) ? 0 : Math.round((cat.portes?.valor ?? 7) * 100);
  $('#itens').innerHTML = itensHTML(linhas.map(l => ({ ...l, preco: l.pa })), cat.porVar);
  $('#tots').innerHTML = totaisHTML({ subtotal: antesCupao, portes, total: subtotal + portes, desconto: original - antesCupao, desconto_pct: pct || pctMax, campanha: linhas.some(l => l.pcamp && l.pcamp >= l.dv) ? c?.nome : 'Promoção', cupao: cup?.portes_gratis ? cup.nome : '', cupDesc: antesCupao - subtotal, cupNome: cup?.nome, cupPct: cup?.pct });
  $('#resTit').textContent = `Ver resumo · ${n} peça${n > 1 ? 's' : ''}`;
  $('#resTot').textContent = eur(subtotal + portes);
  $('#wa').href = waLink(`Olá Incomum! Estou a pagar no site (${linhas.map(l => l.qtd + '× ' + l.produto + (l.tam ? ' tam. ' + l.tam : '')).join(', ')}) e tenho uma dúvida.`);

  if (subtotal + portes < 50) return erro('<b>O total mínimo para pagar online é 0,50 €.</b><p>Junta mais uma peça ao carrinho ou fala connosco no WhatsApp.</p>');
  const sem = linhas.filter(l => l.stock < l.qtd);
  if (sem.length) return erro(`<b>Algumas peças já não têm stock suficiente:</b><ul>${sem.map(l => `<li>${esc(l.produto)} (${desc(l)})</li>`).join('')}</ul><p>Ajusta o carrinho e tenta de novo.</p>`);

  // 2. Pagamento embutido.
  if (!CFG.stripeChave || !window.Stripe) return erro('<b>O pagamento não está disponível neste momento.</b><p>Tenta daqui a pouco ou fala connosco no WhatsApp.</p>');
  const stripe = Stripe(CFG.stripeChave, { locale: 'pt' });
  const fetchClientSecret = async () => {
    const r = await fetch(CFG.checkoutUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'embedded', cupao: cup ? cup.codigo : '', itens: linhas.map(l => ({ variante: l.variante, qtd: l.qtd })) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.clientSecret) throw Object.assign(new Error(d.erro || 'Não foi possível abrir o pagamento.'), { esgotados: d.esgotados });
    return d.clientSecret;
  };
  try {
    const checkout = await stripe.createEmbeddedCheckoutPage({ fetchClientSecret });
    $('#checkout').innerHTML = '';
    checkout.mount('#checkout');
  } catch (e) {
    erro(`<b>${esc(e.message)}</b><p>${e.esgotados ? 'Ajusta o carrinho e tenta de novo.' : 'Tenta de novo daqui a pouco.'}</p>`);
  }
})();
