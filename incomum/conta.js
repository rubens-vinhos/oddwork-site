/* Conta do cliente: encomendas em tempo real (sessão por link mágico) ou uma encomenda pelo link do e-mail (?t=token) */
(async () => {
  // Sessão guardada à parte (storageKey próprio): nunca se mistura com o painel da Oddwork no mesmo domínio.
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseChave, {
    auth: { storageKey: 'incomum-conta', persistSession: true, detectSessionInUrl: true, flowType: 'implicit' },
  });
  $('#wa').href = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent('Olá! Tenho uma dúvida sobre a minha encomenda.')}`;
  const porVar = await catalogo().then(c => c.porVar).catch(() => ({}));
  const token = new URLSearchParams(location.search).get('t');

  const cartao = (e, aberto) => `
    <article class="cartao enc" data-id="${esc(e.numero)}">
      <header class="enc-h">
        <div><h2>Encomenda n.º ${e.numero}</h2><small class="muted">${dataPT(e.pago_em || e.criado)} · ${eur(e.total)}</small></div>
        <span class="estado e-${esc(e.estado)}">${{ paga: 'Paga', preparacao: 'Em preparação', enviada: 'Enviada', entregue: 'Entregue', cancelada: 'Cancelada' }[e.estado] || esc(e.estado)}</span>
      </header>
      ${linhaTempo(e)}
      <details ${aberto ? 'open' : ''}><summary>Ver peças${e.morada?.linha1 ? ' e morada' : ''}</summary>
        ${itensHTML(e.itens, porVar)}${totaisHTML(e)}
        <p class="enc-wa"><a href="${waLink(`Olá Incomum! Tenho uma dúvida sobre a minha encomenda n.º ${e.numero}.`)}" target="_blank" rel="noopener">Dúvida sobre esta encomenda? WhatsApp</a></p>
        ${e.morada?.linha1 ? `<p class="morada"><b>Enviar para</b>${esc(e.morada.nome || e.nome)}<br>${esc(e.morada.linha1)}${e.morada.linha2 ? ', ' + esc(e.morada.linha2) : ''}<br>${esc(e.morada.codigo_postal)} ${esc(e.morada.cidade)}</p>` : ''}
      </details>
    </article>`;

  // ---------- Link do e-mail (sem conta) ----------
  async function porToken() {
    let e = null;
    try { e = await rpc('incomum_acompanhar', { p_token: token }); } catch { /* sem ligação */ }
    if (!e) {
      $('#titulo').textContent = 'Encomenda não encontrada';
      $('#sub').textContent = 'O link pode estar incompleto. Entra com o teu e-mail para veres as tuas encomendas.';
      $('#entrar').hidden = false; $('#lista').innerHTML = '';
      return false;
    }
    $('#titulo').textContent = `Olá${e.nome ? ', ' + e.nome : ''}!`;
    $('#sub').innerHTML = 'Esta página atualiza-se sozinha. <a href="#" id="irEntrar">Entra com o teu e-mail</a> para veres todas as tuas encomendas.';
    $('#irEntrar').onclick = ev => { ev.preventDefault(); $('#entrar').hidden = false; $('#entrar').scrollIntoView({ behavior: 'smooth' }); $('#email').focus(); };
    $('#lista').innerHTML = cartao(e, true);
    return true;
  }

  // ---------- Sessão (tempo real) ----------
  let canal = null;
  async function minhas(session) {
    $('#entrar').hidden = true; $('#sair').hidden = false;
    $('#titulo').textContent = 'As minhas encomendas';
    $('#sub').textContent = session.user.email;
    const { data, error } = await sb.from('incomum_encomendas')
      .select('numero, estado, total, subtotal, portes, nome, morada, criado, pago_em, preparacao_em, enviado_em, entregue_em, transportadora, seguimento, itens:incomum_itens(variante_id, produto, cor, tam, qtd, preco)')
      .eq('email', session.user.email.toLowerCase())
      .in('estado', ['paga', 'preparacao', 'enviada', 'entregue', 'cancelada'])
      .order('criado', { ascending: false });
    if (error) { $('#lista').innerHTML = '<div class="cartao vazio">Não foi possível carregar as encomendas. Atualiza a página.</div>'; return; }
    $('#lista').innerHTML = data.length
      ? `<p class="ao-vivo"><span></span>Atualiza em tempo real</p>${data.map((e, i) => cartao(e, i === 0 && data.length === 1)).join('')}`
      : '<div class="cartao vazio"><b>Ainda não tens encomendas com este e-mail.</b><p class="muted">Se compraste com outro e-mail, sai e entra com esse.</p><a class="btn" href="./#loja">Ver a coleção</a></div>';
    if (!canal) {
      canal = sb.channel('incomum-minhas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incomum_encomendas' }, () => minhas(session))
        .subscribe();
    }
  }

  $('#fEntrar').onsubmit = async ev => {
    ev.preventDefault();
    const email = $('#email').value.trim().toLowerCase();
    $('#eEntrar').hidden = true; $('#enviado').hidden = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#eEntrar').textContent = 'Escreve um e-mail válido.'; $('#eEntrar').hidden = false; return; }
    $('#bEntrar').disabled = true; $('#bEntrar').textContent = 'A enviar…';
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
    $('#bEntrar').disabled = false; $('#bEntrar').textContent = 'Enviar link de entrada';
    if (error && /rate|seconds|too many/i.test(error.message)) {
      $('#eEntrar').textContent = 'Já pediste um link há pouco. Espera um minuto e tenta de novo.'; $('#eEntrar').hidden = false; return;
    }
    // Mesma resposta exista ou não conta (não revela quem comprou).
    $('#enviado').innerHTML = `Se <b>${esc(email)}</b> tiver compras na Incomum, vais receber um e-mail com o link para entrares. Vê também a pasta de spam.`;
    $('#enviado').hidden = false;
  };
  $('#sair').onclick = async () => { await sb.auth.signOut(); location.href = location.pathname; };

  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_IN' && session) { history.replaceState(null, '', location.pathname); minhas(session); }
  });
  const { data: { session } } = await sb.auth.getSession();
  if (session) return minhas(session);
  if (token) {
    if (await porToken()) {
      setInterval(() => { if (!document.hidden) porToken(); }, 20000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) porToken(); });
    }
    return;
  }
  $('#titulo').textContent = 'Acompanhar encomenda';
  $('#entrar').hidden = false;
})();
