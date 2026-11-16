/* Página de pagamento: resumo do saco + Stripe Embedded Checkout */
(async () => {
  const saco = Saco.ler();
  const erro = (html, voltar = true) => {
    $('#checkout').innerHTML = '';
    $('#erro').innerHTML = html + (voltar ? '<a class="btn" href="./#saco">Voltar ao saco</a>' : '');
    $('#erro').hidden = false;
  };
  $('#resTog').onclick = () => {
    const ab = $('#res').classList.toggle('aberto');
    $('#resTog').setAttribute('aria-expanded', ab);
  };

  if (!saco.length) {
    $('#itens').innerHTML = '';
    $('#res').hidden = true;
    return erro('<b>O teu saco está vazio.</b><p>Escolhe as tuas peças e volta aqui para pagar.</p><a class="btn" href="./#loja">Ver a coleção</a>', false);
  }

  // 1. Resumo com preços e stock reais.
  let cat;
  try { cat = await catalogo(); } catch { return erro('<b>Não foi possível carregar o resumo.</b><p>Verifica a ligação e atualiza a página.</p>'); }
  const linhas = saco.filter(i => cat.porVar[i.v]).map(i => {
    const x = cat.porVar[i.v];
    return { variante: i.v, qtd: i.q, produto: x.p.nome, cor: x.v.cor, tam: x.v.tam, preco: precoDe(x), stock: x.stock };
  });
  const subtotal = linhas.reduce((a, l) => a + l.preco * l.qtd, 0);
  const portes = Math.round((cat.portes?.valor ?? 10) * 100);
  const n = linhas.reduce((a, l) => a + l.qtd, 0);
  $('#itens').innerHTML = itensHTML(linhas, cat.porVar);
  $('#tots').innerHTML = totaisHTML({ subtotal, portes, total: subtotal + portes });
  $('#resTit').textContent = `Ver resumo · ${n} peça${n > 1 ? 's' : ''}`;
  $('#resTot').textContent = eur(subtotal + portes);
  $('#wa').href = waLink(`Olá Incomum! Estou a pagar no site (${linhas.map(l => l.qtd + '× ' + l.produto + (l.tam ? ' tam. ' + l.tam : '')).join(', ')}) e tenho uma dúvida.`);

  const sem = linhas.filter(l => l.stock < l.qtd);
  if (sem.length) return erro(`<b>Algumas peças já não têm stock suficiente:</b><ul>${sem.map(l => `<li>${esc(l.produto)} (${desc(l)})</li>`).join('')}</ul><p>Ajusta o saco e tenta de novo.</p>`);

  // 2. Pagamento embutido.
  if (!CFG.stripeChave || !window.Stripe) return erro('<b>O pagamento não está disponível neste momento.</b><p>Tenta daqui a pouco ou fala connosco no WhatsApp.</p>');
  const stripe = Stripe(CFG.stripeChave, { locale: 'pt' });
  const fetchClientSecret = async () => {
    const r = await fetch(CFG.checkoutUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'embedded', itens: linhas.map(l => ({ variante: l.variante, qtd: l.qtd })) }),
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
    erro(`<b>${esc(e.message)}</b><p>${e.esgotados ? 'Ajusta o saco e tenta de novo.' : 'Tenta de novo daqui a pouco.'}</p>`);
  }
})();
