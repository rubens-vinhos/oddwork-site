/* Página de obrigado: confirma a encomenda (o webhook marca-a paga) e mostra o resumo */
(async () => {
  const sessao = new URLSearchParams(location.search).get('s') || '';
  $('#wa').href = waLink('Olá Incomum! Acabei de fazer uma compra no site e tenho uma dúvida.');
  Saco.limpar();
  const topo = (ico, titulo, texto) => {
    $('#topo').innerHTML = `<div class="ob-ico ${ico}">${ico === 'ok' ? '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>' : '<span class="spin"></span>'}</div><h1>${titulo}</h1><p class="muted">${texto}</p>`;
  };
  if (!/^cs_\w+$/.test(sessao)) return topo('ok', 'Obrigado pela tua compra!', 'Vais receber um e-mail de confirmação com o link para acompanhares a encomenda.');

  const fotos = catalogo().then(c => c.porVar).catch(() => ({}));
  let e = null;
  for (let n = 0; n < 20; n++) {
    try { e = await rpc('incomum_estado_encomenda', { sessao }); } catch { /* tenta outra vez */ }
    if (e && e.estado !== 'pendente') break;
    await new Promise(r => setTimeout(r, n < 8 ? 1500 : 3000));
  }
  if (!e) return topo('ok', 'Obrigado pela tua compra!', 'Vais receber um e-mail de confirmação com o link para acompanhares a encomenda. Qualquer dúvida, fala connosco no WhatsApp.');

  $('#wa').href = waLink(`Olá Incomum! Tenho uma dúvida sobre a minha encomenda n.º ${e.numero}.`);
  const pago = ['paga', 'preparacao', 'enviada', 'entregue'].includes(e.estado);
  if (pago) {
    topo('ok', 'Obrigado pela tua compra!', `Encomenda <b>n.º ${e.numero}</b> confirmada. A Incomum enviou um e-mail de confirmação para <b>${esc(e.email || 'o teu e-mail')}</b>.`);
    document.title = `Encomenda n.º ${e.numero} · Incomum.eu`;
  } else if (e.estado === 'pendente') {
    topo('a-confirmar', `Encomenda n.º ${e.numero} registada`, 'O pagamento ainda está a ser confirmado (com MB WAY pode demorar um pouco). Assim que estiver, recebes o e-mail de confirmação.');
  } else {
    return topo('erro', 'O pagamento não foi concluído', 'Não te foi cobrado nada. Podes voltar ao carrinho e tentar de novo.');
  }

  $('#tl').innerHTML = linhaTempo({ ...e, pago_em: pago ? new Date().toISOString() : null });
  if (e.token) $('#acomp').href = 'conta.html?t=' + e.token; else $('#acomp').hidden = true;
  $('#itens').innerHTML = itensHTML(e.itens, await fotos);
  $('#tots').innerHTML = totaisHTML(e);
  $('#corpo').hidden = false;
})();
