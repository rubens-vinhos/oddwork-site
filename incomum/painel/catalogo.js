/* Painel Incomum — Produtos (criar/editar, fotos, cores, tamanhos, preço, desconto, stock), Categorias e Venda na loja.
   Usa sb, S, $, $$, esc, eur, toast, szOrd de painel.js. Tudo protegido por RLS (incomum_e_equipa). */
const BUCKET = 'incomum-fotos';
const C = { prods: [], cats: [], q: '', cat: '', ed: null, venda: [], vq: '' };
const fotoURL = u => (!u ? '' : /^https?:/.test(u) ? u : '../' + u);
const centimos = v => { const n = Math.round(parseFloat(String(v).replace(',', '.')) * 100); return Number.isFinite(n) ? n : NaN; };
const euros = c => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
const slugify = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'produto';
const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const final = v => Math.round((v.promo && v.promo < v.preco ? v.promo : v.preco) * (100 - (v.desconto || 0)) / 100);

async function carregarCats() {
  const { data, error } = await sb.from('incomum_categorias').select('*').order('ordem');
  if (!error) C.cats = data;
  return C.cats;
}
async function carregarProds() {
  const { data, error } = await sb.from('incomum_produtos')
    .select('id, slug, nome, descricao, categorias, fotos, destaque, ativo, ordem, criado, variantes:incomum_variantes(id, cor, tam, preco, promo, desconto, stock, ativo, na_campanha)')
    .order('ordem');
  if (error) { toast('Não foi possível carregar os produtos'); return null; }
  C.prods = data;
  for (const p of data) { S.fotos[p.id] = fotoURL((p.fotos[0] || {}).url); for (const v of p.variantes) S.fotoVar[v.id] = fotoURL(((p.fotos.find(f => f.cor === v.cor) || p.fotos[0]) || {}).url); }
  return data;
}

/* =================== PRODUTOS: lista =================== */
async function carregarProdutos() {
  $('#view').innerHTML = '<div class="empty">A carregar os produtos…</div>';
  await Promise.all([carregarCats(), carregarProds()]);
  listaView();
}
function listaView() {
  const q = C.q.toLowerCase();
  const L = C.prods.filter(p => (!C.cat || p.categorias.includes(C.cat)) && (!q || p.nome.toLowerCase().includes(q) || p.variantes.some(v => (v.cor || '').toLowerCase().includes(q))));
  const un = p => p.variantes.filter(v => v.ativo).reduce((a, v) => a + v.stock, 0);
  const promo = p => p.variantes.some(v => v.ativo && v.desconto > 0);
  $('#view').innerHTML = `
    <div class="kpis"><div class="kpi"><small>Produtos</small><b>${C.prods.length}</b></div><div class="kpi"><small>Visíveis na loja</small><b>${C.prods.filter(p => p.ativo).length}</b></div>
      <div class="kpi"><small>Unidades em stock</small><b>${C.prods.reduce((a, p) => a + un(p), 0)}</b></div><div class="kpi"><small>Com desconto próprio</small><b>${C.prods.filter(promo).length}</b></div></div>
    <div class="bar"><button class="btn grad" id="novoP">+ Novo produto</button>
      <input class="search" id="qp" placeholder="Procurar produto ou cor…" value="${esc(C.q)}">
      <select class="search" id="cp" style="max-width:220px"><option value="">Todas as categorias</option>${C.cats.map(c => `<option value="${esc(c.slug)}" ${c.slug === C.cat ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
    <div class="pgrid">${L.map(p => {
      const u = un(p), vs = p.variantes.filter(v => v.ativo), pr = vs.length ? Math.min(...vs.map(final)) : 0;
      const cores = [...new Set(vs.map(v => v.cor).filter(Boolean))];
      const cat = C.cats.find(c => c.grupo === 'tipo' && p.categorias.includes(c.slug));
      return `<article class="pcard${p.ativo ? '' : ' oculto'}" data-p="${p.id}">
        <div class="pc-foto"><img src="${S.fotos[p.id] || ''}" alt="" loading="lazy">
          ${promo(p) ? '<span class="pc-tag desc">Desconto</span>' : ''}${p.ativo ? '' : '<span class="pc-tag">Escondido</span>'}</div>
        <div class="pc-info"><b>${esc(p.nome)}</b>
          <small>${esc(cat ? cat.nome : 'Sem categoria')}</small>
          <div class="pc-l"><span class="pc-pr">${eur(pr)}</span><span class="pc-st${u ? '' : ' zero'}">${u ? u + ' em stock' : 'Esgotado'}</span></div>
          ${cores.length ? `<div class="pc-cores">${cores.slice(0, 6).map(c => `<span>${esc(c)}</span>`).join('')}${cores.length > 6 ? `<span>+${cores.length - 6}</span>` : ''}</div>` : ''}
        </div>
        <button class="btn line pc-ed">✏️ Editar</button></article>`;
    }).join('') || '<div class="empty">Nenhum produto.</div>'}</div>`;
  $('#qp').oninput = e => { C.q = e.target.value; const k = e.target.selectionStart; listaView(); $('#qp').focus(); $('#qp').setSelectionRange(k, k); };
  $('#cp').onchange = e => { C.cat = e.target.value; listaView(); };
  $('#novoP').onclick = () => editar(null);
  $$('.pcard').forEach(c => c.onclick = () => editar(c.dataset.p));
}

/* =================== PRODUTOS: editor =================== */
function editar(id) {
  const p = id ? C.prods.find(x => x.id === id) : null;
  C.ed = p ? JSON.parse(JSON.stringify(p)) : { id: null, nome: '', slug: '', descricao: '', categorias: C.cat ? [C.cat] : [], fotos: [], destaque: false, ativo: true, ordem: 0, variantes: [] };
  C.ed.apagar = [];
  edView();
  scrollTo(0, 0);
}
const coresDe = e => [...new Set(e.variantes.filter(v => !v.apagada).map(v => v.cor).filter(Boolean))];
function edView() {
  const e = C.ed, cores = coresDe(e);
  const temPromo = e.variantes.some(v => !v.apagada && v.promo);
  const fotoCor = c => (e.fotos.find(f => f.cor === c) || e.fotos.find(f => !f.cor) || {}).url;
  const fotosHTML = (lista, cor) => `<div class="fotos">${lista.map(({ f, i }) => `<div class="foto"><img src="${esc(fotoURL(f.url))}" alt="">
      <select data-fc="${i}" title="De que cor é esta foto?"><option value="">${cor ? 'Passar para gerais' : 'Todas as cores'}</option>${cores.map(k => `<option ${f.cor === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
      <div class="foto-b"><button data-fm="${i}" data-d="-1" title="Mais para a frente">‹</button><button data-fx="${i}" title="Tirar foto">✕</button><button data-fm="${i}" data-d="1" title="Mais para trás">›</button></div></div>`).join('')}
      <label class="foto add"><input type="file" accept="image/*" multiple hidden data-up="${esc(cor)}"><span>📷<br>${cor ? 'Juntar fotos<br>desta cor' : 'Juntar fotos'}</span></label></div>`;
  const comI = e.fotos.map((f, i) => ({ f, i }));
  const linhas = c => e.variantes.map((v, i) => ({ v, i })).filter(x => !x.v.apagada && (x.v.cor || '') === c).sort((a, b) => szOrd(a.v.tam, b.v.tam));
  $('#view').innerHTML = `
  <div class="ed">
    <div class="ed-top"><button class="ghost sm" id="voltar">‹ Produtos</button>
      ${fotoCor(cores[0]) ? `<img class="ed-capa" src="${esc(fotoURL(e.fotos[0] ? e.fotos[0].url : fotoCor(cores[0])))}" alt="">` : ''}<h2>${e.id && C.prods.some(p => p.id === e.id) ? esc(e.nome) : 'Novo produto'}</h2>
      <div class="ed-acts">${C.prods.some(p => p.id === e.id) ? '<button class="ghost sm" id="apagarP">Apagar</button>' : ''}<button class="btn grad" id="guardarP">Guardar</button></div></div>

    <section class="card ed-sec"><h3>1 · Nome, descrição e onde aparece</h3>
      <label class="fl">Nome do produto<input id="eNome" maxlength="120" value="${esc(e.nome)}" placeholder="Ex.: Legging Allure® Adaptiv"></label>
      <label class="fl">Descrição<textarea id="eDesc" rows="3" placeholder="Tecido, modelagem, cuidados…">${esc(e.descricao)}</textarea></label>
      <div class="fl">Categorias <small class="muted">(toca para escolher onde aparece no site)</small>
        <div class="chips">${C.cats.map(c => `<label class="chip ${e.categorias.includes(c.slug) ? 'on' : ''}"><input type="checkbox" data-cat="${esc(c.slug)}" ${e.categorias.includes(c.slug) ? 'checked' : ''} hidden>${esc(c.nome)}</label>`).join('')}</div></div>
      <div class="ed-sw"><label class="sw"><input type="checkbox" id="eAtivo" ${e.ativo ? 'checked' : ''}><span></span>Visível na loja</label>
        <label class="sw"><input type="checkbox" id="eDest" ${e.destaque ? 'checked' : ''}><span></span>Destaque (aparece primeiro)</label></div>
    </section>

    <h3 class="ed-h">2 · Cores <small class="muted">cada cor tem as suas fotos (o site mostra só essas quando o cliente escolhe a cor) e os seus tamanhos</small></h3>
    ${cores.map(c => `<section class="card ed-sec cor-card" data-cor="${esc(c)}">
      <div class="cor-h"><div class="cor-capa">${fotoCor(c) ? `<img src="${esc(fotoURL(fotoCor(c)))}" alt="">` : '<span>sem foto</span>'}</div>
        <div class="cor-t"><label class="fl">Cor<input data-rn="${esc(c)}" value="${esc(c)}" maxlength="40"></label>
          <div class="cor-q"><input data-cd="${esc(c)}" inputmode="numeric" placeholder="%" class="w4"><button class="ghost sm" data-cdb="${esc(c)}">Desconto nesta cor</button>
            <button class="ghost sm" data-cdel="${esc(c)}">Apagar cor</button></div></div></div>
      <h4>Fotos desta cor</h4>${fotosHTML(comI.filter(x => x.f.cor === c), c)}
      <h4>Tamanhos</h4>
      <div class="vt-wrap"><table class="vt vt-tam"><tr><th>Tamanho</th><th>Preço €</th>${temPromo ? '<th>Promo €</th>' : ''}<th>Desconto %<small>só este tamanho</small></th><th>Cliente paga</th><th>Stock</th><th></th></tr>
        ${linhas(c).map(({ v, i }) => `<tr class="${v.desconto > 0 ? 'com-desc' : ''}">
          <td data-l="Tamanho"><input data-vi="${i}" data-k="tam" value="${esc(v.tam || '')}" class="w4"></td>
          <td data-l="Preço €"><input data-vi="${i}" data-k="preco" inputmode="decimal" value="${euros(v.preco)}" class="w6"></td>
          ${temPromo ? `<td data-l="Promo €"><input data-vi="${i}" data-k="promo" inputmode="decimal" value="${euros(v.promo)}" class="w6"></td>` : ''}
          <td data-l="Desconto %"><input data-vi="${i}" data-k="desconto" inputmode="numeric" value="${v.desconto || ''}" placeholder="0" class="w4"></td>
          <td class="fin" data-l="Cliente paga">${Number.isFinite(final(v)) ? eur(final(v)) : '—'}</td>
          <td data-l="Stock"><div class="st${v.stock ? '' : ' zero'}"><button data-vs="${i}" data-d="-1">−</button><input data-vi="${i}" data-k="stock" inputmode="numeric" value="${v.stock}"><button data-vs="${i}" data-d="1">+</button></div></td>
          <td class="vx"><button class="ghost sm" data-vx="${i}" title="Tirar este tamanho">✕</button></td></tr>`).join('')}</table></div>
      <div class="cor-add"><input data-nt="${esc(c)}" placeholder="Novo tamanho (ex.: L)" class="w6"><button class="ghost sm" data-ntb="${esc(c)}">+ Tamanho</button></div>
    </section>`).join('')}

    <section class="card ed-sec nova-cor"><h3>+ Nova cor</h3>
      <div class="gera"><input id="gCor" placeholder="Cor (ex.: Preto)">
        <input id="gTam" placeholder="Tamanhos (ex.: S M L)" value="S M L">
        <input id="gPreco" inputmode="decimal" placeholder="Preço €" value="${e.variantes.find(v => !v.apagada) ? euros(e.variantes.find(v => !v.apagada).preco) : ''}">
        <input id="gStock" inputmode="numeric" placeholder="Stock de cada tamanho" value="1">
        <button class="btn grad" id="gAdd">Criar cor</button></div>
      <p class="muted">Depois de criar, juntas as fotos dessa cor no cartão dela.</p></section>

    <section class="card ed-sec"><h3>3 · Fotos gerais <small class="muted">aparecem em todas as cores · a 1.ª foto do produto é a capa no site</small></h3>
      ${fotosHTML(comI.filter(x => !x.f.cor), '')}<p class="muted" id="upMsg"></p></section>

    <p class="muted ed-nota">O desconto % vale só para essa cor/tamanho (ex.: Preto M com 30% e Preto S sem). Durante a campanha o cliente fica com o maior dos dois descontos, nunca os dois somados.</p>
    <div class="ed-fim"><button class="btn grad" id="guardarP2">Guardar produto</button></div>
  </div>`;
  ligarEd();
}
function lerCampos() {
  const e = C.ed;
  e.nome = $('#eNome').value.trim(); e.descricao = $('#eDesc').value.trim();
  e.ativo = $('#eAtivo').checked; e.destaque = $('#eDest').checked;
  e.categorias = $$('[data-cat]').filter(i => i.checked).map(i => i.dataset.cat);
}
function ligarEd() {
  const e = C.ed, todas = c => e.variantes.filter(v => !v.apagada && (v.cor || '') === c);
  $('#voltar').onclick = () => carregarProdutos();
  $$('[data-cat]').forEach(i => i.onchange = () => i.parentElement.classList.toggle('on', i.checked));
  $('#guardarP').onclick = $('#guardarP2').onclick = guardarProduto;
  if ($('#apagarP')) $('#apagarP').onclick = apagarProduto;
  // fotos
  $$('[data-fm]').forEach(b => b.onclick = () => {
    lerCampos(); const i = +b.dataset.fm, cor = e.fotos[i].cor || null, d = +b.dataset.d;
    let j = i + d; while (j >= 0 && j < e.fotos.length && (e.fotos[j].cor || null) !== cor) j += d;   // troca com a foto vizinha da mesma cor
    if (j < 0 || j >= e.fotos.length) return;
    [e.fotos[i], e.fotos[j]] = [e.fotos[j], e.fotos[i]]; edView();
  });
  $$('[data-fx]').forEach(b => b.onclick = () => { lerCampos(); e.fotos.splice(+b.dataset.fx, 1); edView(); });
  $$('[data-fc]').forEach(sel => sel.onchange = () => { lerCampos(); e.fotos[+sel.dataset.fc].cor = sel.value || null; edView(); toast(sel.value ? `Foto passada para ${sel.value}` : 'Foto passada para as gerais'); });
  $$('[data-up]').forEach(inp => inp.onchange = ev => enviarFotos([...ev.target.files], inp.dataset.up || null));
  // cores
  $$('[data-rn]').forEach(inp => inp.onchange = () => {
    const de = inp.dataset.rn, para = inp.value.trim(); if (!para) { inp.value = de; return toast('A cor precisa de nome'); }
    if (para !== de && coresDe(e).includes(para)) { inp.value = de; return toast('Já existe essa cor'); }
    lerCampos(); todas(de).forEach(v => { v.cor = para; v.mudou = true; }); e.fotos.forEach(f => { if (f.cor === de) f.cor = para; }); edView();
  });
  $$('[data-cdb]').forEach(b => b.onclick = () => {
    const c = b.dataset.cdb, n = Math.round(+$(`[data-cd="${CSS.escape(c)}"]`).value || 0);
    if (n < 0 || n > 90) return toast('Desconto entre 0% e 90%');
    lerCampos(); todas(c).forEach(v => { v.desconto = n; v.mudou = true; }); edView(); toast(n ? `-${n}% em todos os tamanhos de ${c}` : `Sem desconto em ${c}`);
  });
  $$('[data-cdel]').forEach(b => b.onclick = () => {
    const c = b.dataset.cdel; if (!confirm(`Apagar a cor ${c} (todos os tamanhos)?`)) return;
    lerCampos(); todas(c).forEach(v => { if (v.novo) e.variantes.splice(e.variantes.indexOf(v), 1); else { v.apagada = true; e.apagar.push(v.id); } });
    e.fotos.forEach(f => { if (f.cor === c) f.cor = null; }); edView();
  });
  $$('[data-ntb]').forEach(b => b.onclick = () => {
    const c = b.dataset.ntb, t = $(`[data-nt="${CSS.escape(c)}"]`).value.trim().toUpperCase(); if (!t) return toast('Escreve o tamanho');
    if (todas(c).some(v => v.tam === t)) return toast('Esse tamanho já existe');
    const base = todas(c)[0] || {}; lerCampos();
    e.variantes.push({ id: uid('var'), novo: true, cor: c, tam: t, preco: base.preco || 0, promo: null, desconto: base.desconto || 0, stock: 1, ativo: true }); edView();
  });
  // tamanhos
  $$('[data-vi]').forEach(inp => inp.onchange = () => {
    const v = e.variantes[+inp.dataset.vi], k = inp.dataset.k, t = inp.value.trim();
    if (k === 'tam') v.tam = t.toUpperCase();
    else if (k === 'preco') { const c = centimos(t); if (!(c > 0)) { toast('Preço inválido'); inp.value = euros(v.preco); return; } v.preco = c; }
    else if (k === 'promo') { if (!t) v.promo = null; else { const c = centimos(t); if (!(c > 0)) { toast('Promo inválida'); inp.value = euros(v.promo); return; } v.promo = c; } }
    else if (k === 'desconto') { const n = Math.round(+t || 0); if (n < 0 || n > 90) { toast('Desconto entre 0% e 90%'); inp.value = v.desconto || ''; return; } v.desconto = n; }
    else if (k === 'stock') v.stock = Math.max(0, Math.round(+t || 0));
    v.mudou = true; lerCampos(); edView();
  });
  $$('[data-vs]').forEach(b => b.onclick = () => { const v = e.variantes[+b.dataset.vs]; v.stock = Math.max(0, (v.stock || 0) + +b.dataset.d); v.mudou = true; lerCampos(); edView(); });
  $$('[data-vx]').forEach(b => b.onclick = () => { const v = e.variantes[+b.dataset.vx]; lerCampos(); if (!v.novo) { v.apagada = true; e.apagar.push(v.id); } else e.variantes.splice(+b.dataset.vx, 1); edView(); });
  $('#gAdd').onclick = () => {
    const cor = $('#gCor').value.trim(), tams = $('#gTam').value.split(/[\s,;/]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
    const preco = centimos($('#gPreco').value), st = Math.max(0, Math.round(+$('#gStock').value || 0));
    if (!cor) return toast('Escreve a cor');
    if (coresDe(e).includes(cor)) return toast('Essa cor já existe: junta tamanhos no cartão dela');
    if (!(preco > 0)) return toast('Escreve o preço');
    lerCampos();
    for (const t of (tams.length ? tams : [''])) e.variantes.push({ id: uid('var'), novo: true, cor, tam: t, preco, promo: null, desconto: 0, stock: st, ativo: true });
    edView();
    $(`.cor-card[data-cor="${CSS.escape(cor)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
}
// Fotos: reduz no telemóvel/computador (máx. 1600 px, WebP) e envia para o Storage.
function reduzir(file) {
  return new Promise((ok, falha) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      cv.toBlob(b => (b ? ok(b) : falha(new Error('imagem'))), 'image/webp', 0.86);
    };
    img.onerror = () => falha(new Error('Não é uma imagem'));
    img.src = url;
  });
}
async function enviarFotos(files, cor = null) {
  const e = C.ed; lerCampos();
  if (!e.id) e.id = uid('prod');
  const corUnica = cor;
  let n = 0;
  for (const f of files) {
    toast(`A enviar foto ${++n} de ${files.length}…`);
    try {
      const b = await reduzir(f), path = `p/${e.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
      const { error } = await sb.storage.from(BUCKET).upload(path, b, { contentType: 'image/webp', cacheControl: '31536000' });
      if (error) throw error;
      e.fotos.push({ url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, cor: corUnica });
    } catch (err) { console.error(err); toast('Uma foto não foi enviada: ' + (err.message || 'erro')); }
  }
  edView();
  toast('Fotos juntas. Carrega em Guardar para ficarem no site.');
}
async function guardarProduto() {
  const e = C.ed; lerCampos();
  if (!e.nome) return toast('Escreve o nome do produto');
  const ativas = e.variantes.filter(v => !v.apagada);
  if (!ativas.length) return toast('Adiciona pelo menos uma cor/tamanho');
  if (ativas.some(v => !(v.preco > 0))) return toast('Há uma linha sem preço');
  if (ativas.some(v => final(v) < 50) && !confirm('Atenção: há peças que ficam abaixo de 0,50 € para o cliente. O pagamento online não aceita valores tão baixos (com o cupão de envio grátis falha). Guardar mesmo assim?')) return;
  const dup = new Set();
  for (const v of ativas) { const k = (v.cor || '') + '|' + (v.tam || ''); if (dup.has(k)) return toast(`Repetido: ${v.cor} ${v.tam}`); dup.add(k); }
  const btns = $$('#guardarP, #guardarP2'); btns.forEach(b => { b.disabled = true; b.textContent = 'A guardar…'; });
  try {
    const novo = !C.prods.some(p => p.id === e.id);
    if (!e.id) e.id = uid('prod');
    if (novo) {
      let slug = slugify(e.nome), k = 2;
      while (C.prods.some(p => p.slug === slug)) slug = slugify(e.nome) + '-' + k++;
      e.slug = slug;
      const ordem = Math.min(0, ...C.prods.map(p => p.ordem)) - 1;
      const { error } = await sb.from('incomum_produtos').insert({ id: e.id, slug, nome: e.nome, descricao: e.descricao, categorias: e.categorias, fotos: e.fotos, destaque: e.destaque, ativo: e.ativo, ordem });
      if (error) throw error;
    } else {
      const { error } = await sb.from('incomum_produtos').update({ nome: e.nome, descricao: e.descricao, categorias: e.categorias, fotos: e.fotos, destaque: e.destaque, ativo: e.ativo }).eq('id', e.id);
      if (error) throw error;
    }
    const agora = new Date().toISOString();
    const ins = ativas.filter(v => v.novo).map(v => ({ id: v.id, produto_id: e.id, cor: v.cor || null, tam: v.tam || null, preco: v.preco, promo: v.promo || null, desconto: v.desconto || 0, stock: v.stock || 0, ativo: true }));
    if (ins.length) { const { error } = await sb.from('incomum_variantes').insert(ins); if (error) throw error; }
    for (const v of ativas.filter(x => !x.novo && x.mudou)) {
      const { error } = await sb.from('incomum_variantes').update({ cor: v.cor || null, tam: v.tam || null, preco: v.preco, promo: v.promo || null, desconto: v.desconto || 0, stock: v.stock || 0, ativo: true, atualizado: agora }).eq('id', v.id);
      if (error) throw error;
    }
    for (const id of e.apagar) {
      const { error } = await sb.from('incomum_variantes').delete().eq('id', id);
      if (error) await sb.from('incomum_variantes').update({ ativo: false, stock: 0, atualizado: agora }).eq('id', id); // já vendida online: fica arquivada
    }
    toast('Produto guardado · já está no site');
    await carregarProds();
    editar(e.id);
  } catch (err) {
    console.error(err);
    toast('Não foi possível guardar: ' + (err.message || 'erro'));
    btns.forEach(b => { b.disabled = false; b.textContent = 'Guardar'; });
  }
}
async function apagarProduto() {
  const e = C.ed;
  if (!confirm(`Apagar "${e.nome}"? Se já tiver vendas online, fica só escondido da loja.`)) return;
  const { error } = await sb.from('incomum_produtos').delete().eq('id', e.id);
  if (error) {
    const r = await sb.from('incomum_produtos').update({ ativo: false }).eq('id', e.id);
    if (r.error) return toast('Não foi possível apagar');
    toast('Tem vendas: ficou escondido da loja');
  } else toast('Produto apagado');
  carregarProdutos();
}

/* =================== CATEGORIAS =================== */
async function carregarCategorias() {
  $('#view').innerHTML = '<div class="empty">A carregar…</div>';
  await Promise.all([carregarCats(), C.prods.length ? null : carregarProds()]);
  const n = slug => C.prods.filter(p => p.categorias.includes(slug)).length;
  const linha = c => `<tr data-c="${esc(c.slug)}"><td data-l="Nome"><input data-ck="nome" value="${esc(c.nome)}" maxlength="60"></td>
    <td data-l="Grupo"><select data-ck="grupo"><option value="tipo" ${c.grupo === 'tipo' ? 'selected' : ''}>Tipo de peça</option><option value="colecao" ${c.grupo === 'colecao' ? 'selected' : ''}>Coleção</option></select></td>
    <td data-l="Monta o teu conjunto"><select data-ck="parte"><option value="">—</option><option value="cima" ${c.parte === 'cima' ? 'selected' : ''}>Parte de cima</option><option value="baixo" ${c.parte === 'baixo' ? 'selected' : ''}>Parte de baixo</option></select></td>
    <td data-l="Ordem"><input data-ck="ordem" inputmode="numeric" value="${c.ordem}" class="w4"></td>
    <td data-l="Visível"><label class="sw"><input type="checkbox" data-ck="ativo" ${c.ativo ? 'checked' : ''}><span></span></label></td>
    <td class="muted" data-l="Produtos">${n(c.slug)}</td><td class="cx"><button class="ghost sm" data-cx="${esc(c.slug)}">Apagar</button></td></tr>`;
  $('#view').innerHTML = `
    <section class="card ed-sec"><h3>Nova categoria</h3>
      <div class="gera"><input id="nCat" placeholder="Nome (ex.: Macacões)" maxlength="60"><select id="nGrupo"><option value="tipo">Tipo de peça</option><option value="colecao">Coleção</option></select>
        <select id="nParte"><option value="">Não entra no "Monta o teu conjunto"</option><option value="cima">Parte de cima</option><option value="baixo">Parte de baixo</option></select><button class="btn grad" id="nAdd">Criar categoria</button></div></section>
    <section class="card ed-sec"><h3>Categorias <small class="muted">as alterações guardam-se sozinhas · "Tipo de peça" aparece no menu do site; "Coleção" nos filtros</small></h3>
      <div class="vt-wrap"><table class="vt vt-cat"><tr><th>Nome</th><th>Grupo</th><th>Monta o teu conjunto</th><th>Ordem</th><th>Visível</th><th>Produtos</th><th></th></tr>${C.cats.map(linha).join('')}</table></div></section>`;
  $('#nAdd').onclick = async () => {
    const nome = $('#nCat').value.trim(); if (!nome) return toast('Escreve o nome');
    let slug = slugify(nome), k = 2; while (C.cats.some(c => c.slug === slug)) slug = slugify(nome) + '-' + k++;
    const { error } = await sb.from('incomum_categorias').insert({ slug, nome, grupo: $('#nGrupo').value, parte: $('#nParte').value || null, ordem: Math.max(0, ...C.cats.map(c => c.ordem)) + 1 });
    if (error) return toast('Não foi possível criar: ' + error.message);
    toast('Categoria criada'); carregarCategorias();
  };
  $$('[data-ck]').forEach(i => i.onchange = async () => {
    const slug = i.closest('tr').dataset.c, k = i.dataset.ck;
    const val = k === 'ativo' ? i.checked : k === 'ordem' ? Math.round(+i.value || 0) : k === 'parte' ? (i.value || null) : i.value.trim();
    if (k === 'nome' && !val) return toast('O nome não pode ficar vazio');
    const { error } = await sb.from('incomum_categorias').update({ [k]: val }).eq('slug', slug);
    if (error) return toast('Não foi possível guardar');
    const c = C.cats.find(x => x.slug === slug); if (c) c[k] = val;
    toast('Guardado');
  });
  $$('[data-cx]').forEach(b => b.onclick = async () => {
    const slug = b.dataset.cx, k = n(slug);
    if (k) return toast(`Tem ${k} produtos. Tira-os primeiro desta categoria (ou desliga "Visível").`);
    if (!confirm('Apagar esta categoria?')) return;
    const { error } = await sb.from('incomum_categorias').delete().eq('slug', slug);
    if (error) return toast('Não foi possível apagar');
    toast('Categoria apagada'); carregarCategorias();
  });
}

/* =================== VENDA NA LOJA (dá baixa no stock) =================== */
async function carregarVenda() {
  $('#view').innerHTML = '<div class="empty">A carregar…</div>';
  await Promise.all([carregarCats(), carregarProds()]);
  vendaView();
}
function vendaView() {
  const q = C.vq.toLowerCase().trim(), cat = C.vcat || '', soStock = C.vstock !== false;
  const temStock = p => p.variantes.some(v => v.ativo && v.stock > 0);
  const L = C.prods.filter(p => p.ativo && (!cat || p.categorias.includes(cat)) && (!q || p.nome.toLowerCase().includes(q)) && (!soStock || temStock(p)));
  const cats = C.cats.filter(c => c.ativo && C.prods.some(p => p.categorias.includes(c.slug)));
  const tot = C.venda.reduce((a, l) => a + l.preco * l.qtd, 0);
  const nPecas = C.venda.reduce((a, l) => a + l.qtd, 0);
  $('#view').innerHTML = `
  <div class="venda">
    <section class="card ed-sec"><h3>1 · Toca na peça que vendeste</h3>
      <div class="chips vchips"><button class="chip ${!cat ? 'on' : ''}" data-vc="">Tudo</button>${cats.map(c => `<button class="chip ${cat === c.slug ? 'on' : ''}" data-vc="${esc(c.slug)}">${esc(c.nome)}</button>`).join('')}</div>
      <div class="vfiltro"><input class="search" id="vq" placeholder="Procurar (opcional)…" value="${esc(C.vq)}" autocomplete="off">
        <label class="sw"><input type="checkbox" id="vSo" ${soStock ? 'checked' : ''}><span></span>Só com stock</label></div>
      <div class="vgrid">${L.map(p => {
        const un = p.variantes.filter(v => v.ativo).reduce((a, v) => a + v.stock, 0);
        return `<button class="vcard" data-vp="${p.id}"><img src="${S.fotos[p.id] || ''}" alt="" loading="lazy"><b>${esc(p.nome)}</b><small>${un ? un + ' em stock' : 'esgotado'}</small></button>`;
      }).join('') || '<div class="empty">Nenhuma peça.</div>'}</div></section>

    <section class="card ed-sec" id="vResumoSec"><h3>2 · Venda</h3>
      ${C.venda.length ? `<div class="vlin">${C.venda.map((l, i) => {
          const p = C.prods.find(x => x.variantes.some(v => v.id === l.variante));
          const f = p ? ((p.fotos.find(k => k.cor === l.cor) || p.fotos[0] || {}).url) : null;
          return `<div class="vl"><img src="${f ? esc(fotoURL(f)) : (p && S.fotos[p.id]) || ''}" alt="">
          <div class="vl-i"><b>${esc(l.produto)}</b><small>${esc([l.cor, l.tam].filter(Boolean).join(' · '))}</small>
            <div class="vl-c"><div class="st"><button data-lq="${i}" data-d="-1" aria-label="Menos">−</button><input value="${l.qtd}" data-lqi="${i}" inputmode="numeric"><button data-lq="${i}" data-d="1" aria-label="Mais">+</button></div>
              <label class="vl-p"><input data-lp="${i}" value="${euros(l.preco)}" inputmode="decimal"> €</label></div></div>
          <div class="vl-r"><button class="vl-x" data-lx="${i}" aria-label="Tirar">✕</button><b>${eur(l.preco * l.qtd)}</b></div></div>`;
        }).join('')}</div>
        <div class="vfim"><label>Pagamento<select id="vPag"><option>Dinheiro</option><option>Cartão</option><option>MB WAY</option><option>Outro</option></select></label>
          <label>Nota (opcional)<input id="vNota" maxlength="300" placeholder="Ex.: cliente habitual"></label>
          <div class="vtot">Total <b>${eur(tot)}</b></div>
          <button class="btn grad" id="vOk">Registar venda e dar baixa no stock</button></div>`
      : '<div class="empty">Toca numa peça do catálogo, escolhe a cor e o tamanho.</div>'}
    </section>
    <section class="card ed-sec"><h3>Últimas vendas na loja</h3><div id="vHist" class="muted">A carregar…</div></section>
  </div>`;
  $('#vq').oninput = e => { C.vq = e.target.value; const k = e.target.selectionStart; vendaView(); $('#vq').focus(); $('#vq').setSelectionRange(k, k); };
  $('#vSo').onchange = e => { C.vstock = e.target.checked; vendaView(); };
  $$('[data-vc]').forEach(b => b.onclick = () => { C.vcat = b.dataset.vc; vendaView(); });
  $$('[data-vp]').forEach(b => b.onclick = () => escolherPeca(b.dataset.vp));
  if (nPecas && $('#vResumo')) $('#vResumo').hidden = false;
  $$('[data-lq]').forEach(b => b.onclick = () => { const l = C.venda[+b.dataset.lq]; l.qtd = Math.min(l.max, Math.max(1, l.qtd + +b.dataset.d)); vendaView(); });
  $$('[data-lqi]').forEach(i => i.onchange = () => { const l = C.venda[+i.dataset.lqi]; l.qtd = Math.min(l.max, Math.max(1, Math.round(+i.value || 1))); vendaView(); });
  $$('[data-lp]').forEach(i => i.onchange = () => { const c = centimos(i.value); if (!(c >= 0)) return toast('Preço inválido'); C.venda[+i.dataset.lp].preco = c; vendaView(); });
  $$('[data-lx]').forEach(b => b.onclick = () => { C.venda.splice(+b.dataset.lx, 1); vendaView(); });
  if ($('#vOk')) $('#vOk').onclick = async () => {
    $('#vOk').disabled = true; $('#vOk').textContent = 'A registar…';
    const { error } = await sb.rpc('incomum_venda_loja', { p_itens: C.venda.map(l => ({ variante: l.variante, qtd: l.qtd, preco: l.preco })), p_pagamento: $('#vPag').value, p_nota: $('#vNota').value.trim() || null });
    if (error) { $('#vOk').disabled = false; $('#vOk').textContent = 'Registar venda e dar baixa no stock'; return toast(error.message.replace(/^.*?: /, '')); }
    toast('Venda registada · stock atualizado (site incluído)');
    C.venda = []; C.vq = ''; await carregarProds(); vendaView();
  };
  historico();
}
async function historico() {
  const { data: vendas, error } = await sb.from("incomum_vendas_loja").select("*").order("criado", { ascending: false }).limit(30);
  const el = $('#vHist'); if (!el) return;
  if (error) { el.textContent = 'Não foi possível carregar.'; return; }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const tHoje = vendas.filter(v => !v.anulada && new Date(v.criado) >= hoje).reduce((a, v) => a + v.total, 0);
  el.innerHTML = vendas.length ? `<p>Hoje: <b>${eur(tHoje)}</b></p>` + vendas.map(v => `<div class="row" style="cursor:default${v.anulada ? ';opacity:.5' : ''}"><span class="n">#${v.id}</span>
      <span>${v.itens.map(i => `${i.qtd}× ${esc(i.produto)} ${esc([i.cor, i.tam].filter(Boolean).join(' '))}`).join('<br>')}<small>${esc(v.pagamento || '')}${v.nota ? ' · ' + esc(v.nota) : ''}</small></span>
      <span class="muted">${data(v.criado)}</span><span class="t">${v.anulada ? 'Anulada' : eur(v.total)}</span>
      <span>${v.anulada ? '' : `<button class="ghost sm" data-an="${v.id}">Anular</button>`}</span></div>`).join('') : '<p>Ainda não há vendas na loja registadas.</p>';
  $$('[data-an]').forEach(b => b.onclick = async () => {
    if (!confirm('Anular esta venda? As peças voltam ao stock.')) return;
    const { error: e2 } = await sb.rpc('incomum_anular_venda_loja', { p_id: +b.dataset.an });
    if (e2) return toast('Não foi possível anular');
    toast('Venda anulada · stock reposto'); await carregarProds(); vendaView();
  });
}

// Janela da peça: foto da cor, cores e tamanhos com stock. Tocar no tamanho junta à venda.
function escolherPeca(id, cor) {
  const p = C.prods.find(x => x.id === id); if (!p) return;
  const vs = p.variantes.filter(v => v.ativo).sort((a, b) => szOrd(a.tam, b.tam));
  const cores = [...new Set(vs.map(v => v.cor || ''))];
  const cc = cor !== undefined ? cor : (cores.find(c => vs.some(v => (v.cor || '') === c && v.stock > 0)) ?? cores[0]);
  const fotoCor = c => fotoURL(((p.fotos.find(f => f.cor === c) || p.fotos[0]) || {}).url);
  $('#dbox').innerHTML = `<div class="dh"><h2>${esc(p.nome)}</h2><button class="x" data-x aria-label="Fechar">✕</button></div>
    <div class="sec vpick"><img class="vbig" src="${fotoCor(cc)}" alt="">
      ${cores.length > 1 || cores[0] ? `<h4>Cor</h4><div class="vcores">${cores.map(c => `<button class="vcor ${c === cc ? 'on' : ''}" data-pc="${esc(c)}"><img src="${fotoCor(c)}" alt=""><span>${esc(c || 'Única')}</span></button>`).join('')}</div>` : ''}
      <h4>Tamanho · toca para juntar à venda</h4>
      <div class="vp-c">${vs.filter(v => (v.cor || '') === cc).map(v => `<button class="vbt" data-add="${v.id}" ${v.stock ? '' : 'disabled'}>${esc(v.tam || 'Único')}<small>${v.stock ? v.stock + ' em stock' : 'esgotado'}</small></button>`).join('')}</div>
    </div>`;
  $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
  $$('#dbox [data-x]').forEach(b => b.onclick = fechar);
  $$('#dbox [data-pc]').forEach(b => b.onclick = () => escolherPeca(id, b.dataset.pc));
  $$('#dbox [data-add]').forEach(b => b.onclick = () => {
    const v = p.variantes.find(x => x.id === b.dataset.add), l = C.venda.find(x => x.variante === v.id);
    if (l) { if (l.qtd < v.stock) l.qtd++; else return toast('Não há mais stock desta peça'); }
    else C.venda.push({ variante: v.id, produto: p.nome, cor: v.cor, tam: v.tam, qtd: 1, preco: final(v), max: v.stock });
    fechar(); toast(`Junto à venda: ${p.nome} ${[v.cor, v.tam].filter(Boolean).join(' ')}`); vendaView();
    $('#vResumoSec')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
