// Painel da equipa Oddwork.
// Versão de teste: lê os pedidos guardados no próprio browser (localStorage) e,
// se ligado, um conjunto de dados de exemplo. Na versão real, a entrada e os dados
// vêm do Supabase (login por link no email, só 2 contas autorizadas).
"use strict";

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const CHAVE_TESTE = "oddwork-pedidos-teste";
const CHAVE_ESTADOS = "oddwork-painel-estados";
const CHAVE_SESSAO = "oddwork-painel-sessao";

const ESTADOS = [
  ["novo", "Novo"],
  ["contactado", "Contactado"],
  ["diagnostico", "Diagnóstico marcado"],
  ["proposta", "Proposta enviada"],
  ["cliente", "Cliente"],
  ["perdido", "Não avançou"],
];
const ORDEM = ESTADOS.map(([v]) => v);
const NOME_ESTADO = Object.fromEntries(ESTADOS);

// ---------- Dados de exemplo (inventados, marcados como exemplo) ----------
function gerarExemplo() {
  const tipos = ["Clínica médica ou dentária", "Clínica de estética", "Academia ou estúdio", "Escola de idiomas", "Professor ou mentor", "Criador que vende aulas"];
  const dores = ["Confirmar marcações e faltas", "Cobrar mensalidades", "Responder sempre às mesmas perguntas", "Gerir turmas e lista de espera"];
  const origens = ["Instagram ou TikTok", "Recebi um email", "Recebi uma chamada ou visita", "Live ou YouTube", "Indicação"];
  const clientes = ["30 a 100", "100 a 300", "Mais de 300", "Menos de 30"];
  const estados = ["novo", "novo", "contactado", "contactado", "diagnostico", "diagnostico", "proposta", "cliente", "perdido", "contactado", "novo", "diagnostico", "perdido", "proposta"];
  const agora = Date.now();
  return estados.map((estado, i) => ({
    id: "ex" + i,
    vid: "exv" + i,
    exemplo: true,
    data: new Date(agora - (i * 2.3 + 0.4) * 864e5).toISOString(),
    nome: "Pessoa de exemplo " + (i + 1),
    negocio: "Negócio de exemplo " + (i + 1),
    tipo: tipos[(i * 5) % tipos.length],
    clientes: clientes[i % clientes.length],
    dor: dores[(i * 3) % dores.length],
    origem: origens[(i * 7) % origens.length],
    pais: i % 3 === 0 ? "Brasil" : "Portugal",
    whatsapp: "",
    email: "",
    estado,
  }));
}

// ---------- Armazenamento ----------
const ler = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

const EXEMPLO = gerarExemplo();
let estadoUI = { aba: "pedidos", dias: 30, exemplo: false, procurar: "", fEstado: "", fPais: "" };

// ---------- Supabase ----------
const CFG = window.ODDWORK || {};
const sb = window.supabase && CFG.supabaseUrl ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseChave) : null;
let modo = null; // "real" (sessão Supabase) ou "teste" (só no computador, sem dados reais)
let PEDIDOS_REAIS = [];
let EVENTOS_REAIS = [];
let PAGAMENTOS_REAIS = [];
let ultimaCarga = 0;

async function lerTudo(tabela, ordem, desde) {
  const linhas = [];
  for (let de = 0; de < 50000; de += 1000) {
    let q = sb.from(tabela).select("*").order(ordem, { ascending: false }).range(de, de + 999);
    if (desde) q = q.gte(ordem, desde);
    const { data, error } = await q;
    if (error) throw error;
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}

async function carregarReais() {
  document.getElementById("resumo").textContent = "A carregar…";
  const desde = new Date(Date.now() - 365 * 864e5).toISOString();
  const [ped, evs, pags] = await Promise.all([lerTudo("pedidos", "criado"), lerTudo("eventos", "t", desde), lerTudo("pagamentos", "criado")]);
  PAGAMENTOS_REAIS = pags;
  ultimaCarga = Date.now();
  PEDIDOS_REAIS = ped.map((p) => ({ ...p, data: p.criado }));
  EVENTOS_REAIS = evs.map((e) => ({ ...(e.dados || {}), tipo: e.tipo, vid: e.vid, sid: e.sid, pagina: e.pagina, mercado: e.mercado, t: e.t }));
}

function todosPedidos() {
  const alterados = ler(CHAVE_ESTADOS, {});
  const reais = modo === "real" ? PEDIDOS_REAIS : [];
  const base = estadoUI.exemplo ? [...reais, ...EXEMPLO] : reais;
  return base
    .map((p) => ({ ...p, estado: alterados[p.id] || p.estado || "novo" }))
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
}

// ---------- Entrada ----------
const entrar = document.getElementById("entrar");
const app = document.getElementById("app");

function abrirPainel() { entrar.hidden = true; app.hidden = false; desenhar(); }
const aviso = document.getElementById("entrar-aviso");
function avisar(t) { aviso.hidden = false; aviso.textContent = t; }

document.querySelectorAll("[data-so-local]").forEach((el) => { el.hidden = !LOCAL; });
document.getElementById("entrar-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sb) { avisar("A ligação à base de dados não carregou. Recarrega a página."); return; }
  const email = e.target.email.value.trim().toLowerCase();
  const password = e.target.senha.value;
  const botao = e.target.querySelector("button[type=submit]");
  botao.disabled = true; botao.textContent = "A entrar…";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  botao.disabled = false; botao.textContent = "Entrar";
  e.target.senha.value = "";
  if (!error) { aviso.hidden = true; return; } // onAuthStateChange abre o painel
  avisar(error.status === 429 ? "Demasiadas tentativas. Espera alguns minutos e tenta outra vez." : "Palavra-passe errada.");
});
document.querySelector(".senha__ver").addEventListener("click", (e) => {
  const campo = document.querySelector('input[name="senha"]');
  const ver = campo.type === "password";
  campo.type = ver ? "text" : "password";
  e.currentTarget.textContent = ver ? "Esconder" : "Ver";
  e.currentTarget.setAttribute("aria-pressed", String(ver));
});
document.getElementById("entrar-teste")?.addEventListener("click", () => {
  if (!LOCAL) return;
  modo = "teste";
  sessionStorage.setItem(CHAVE_SESSAO, "teste");
  estadoUI.exemplo = true;
  document.getElementById("exemplo").checked = true;
  abrirPainel();
});
document.getElementById("sair").addEventListener("click", async () => {
  sessionStorage.removeItem(CHAVE_SESSAO);
  if (modo === "real") await sb.auth.signOut();
  modo = null; PEDIDOS_REAIS = []; EVENTOS_REAIS = [];
  app.hidden = true; entrar.hidden = false;
});

let entrando = false;
async function entrarReal() {
  if (entrando || modo === "real") return;
  entrando = true;
  const { data: equipa, error } = await sb.rpc("e_equipa");
  entrando = false;
  if (error || !equipa) {
    await sb.auth.signOut();
    avisar("Este email não tem acesso ao painel.");
    return;
  }
  modo = "real";
  abrirPainel();
  try { await carregarReais(); } catch { document.getElementById("resumo").textContent = "Não foi possível carregar os dados. Recarrega a página."; return; }
  desenhar();
}

// ---------- Controlos ----------
const fEstado = document.getElementById("f-estado");
ESTADOS.forEach(([v, n]) => fEstado.append(new Option(n, v)));

document.querySelectorAll(".periodo button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".periodo button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    estadoUI.dias = Number(b.dataset.dias);
    desenhar();
  })
);
const caixaExemplo = document.getElementById("exemplo");
caixaExemplo.addEventListener("change", () => { estadoUI.exemplo = caixaExemplo.checked; desenhar(); });
document.getElementById("procurar").addEventListener("input", (e) => { estadoUI.procurar = e.target.value.trim().toLowerCase(); desenharTabela(); });
fEstado.addEventListener("change", (e) => { estadoUI.fEstado = e.target.value; desenharTabela(); });
document.getElementById("f-pais").addEventListener("change", (e) => { estadoUI.fPais = e.target.value; desenharTabela(); });
document.getElementById("exportar").addEventListener("click", exportarCSV);

// ---------- Cálculos ----------
function noPeriodo(lista) {
  if (!estadoUI.dias) return lista;
  const limite = Date.now() - estadoUI.dias * 864e5;
  return lista.filter((p) => new Date(p.data).getTime() >= limite);
}
const chegou = (p, etapa) => p.estado !== "perdido" && ORDEM.indexOf(p.estado) >= ORDEM.indexOf(etapa);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function contarPor(lista, campo) {
  const m = new Map();
  lista.forEach((p) => { const k = p[campo] || "Sem resposta"; m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ---------- Desenho ----------
function el(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "style") n.setAttribute("style", v);
    else if (k.startsWith("data-") || k.startsWith("aria-")) n.setAttribute(k, v);
    else n[k] = v;
  });
  filhos.flat().forEach((f) => n.append(f instanceof Node ? f : document.createTextNode(String(f ?? ""))));
  return n;
}

function desenhar() {
  document.getElementById("faixa-exemplo").hidden = !estadoUI.exemplo;
  if (estadoUI.aba === "visitas") { desenharVisitas(); return; }
  if (estadoUI.aba === "pagamentos") { desenharListaPagamentos(); return; }
  desenharDinheiro();
  desenharHoje();
  const todos = todosPedidos();
  const lista = noPeriodo(todos);
  document.getElementById("faixa-exemplo").hidden = !estadoUI.exemplo;

  const n = lista.length;
  const novos = lista.filter((p) => p.estado === "novo").length;
  const diag = lista.filter((p) => chegou(p, "diagnostico")).length;
  const prop = lista.filter((p) => chegou(p, "proposta")).length;
  const clientesTotal = todos.filter((p) => p.estado === "cliente").length;

  const set = (k, v) => { document.querySelector(`[data-kpi="${k}"]`).textContent = v; };
  const nota = (k, v) => { const x = document.querySelector(`[data-kpi-nota="${k}"]`); if (x) x.textContent = v; };
  set("pedidos", n); set("novos", novos); set("diagnosticos", diag); set("propostas", prop); set("clientes", Math.min(clientesTotal, 10));
  nota("pedidos", estadoUI.dias ? `Nos últimos ${estadoUI.dias} dias` : "Desde o início");
  nota("diagnosticos", n ? `${pct(diag, n)}% dos pedidos` : "");
  nota("propostas", diag ? `${pct(prop, diag)}% dos diagnósticos` : "");
  document.querySelector(".kpi--alerta").classList.toggle("zero", novos === 0);

  const pt = lista.filter((p) => p.pais === "Portugal").length;
  document.getElementById("resumo").textContent = n
    ? `${n} pedido${n === 1 ? "" : "s"} · ${pt} de Portugal, ${n - pt} do Brasil`
    : "Sem pedidos neste período";

  // Funil
  const etapas = [["novo", "Pedidos"], ["contactado", "Contactados"], ["diagnostico", "Diagnóstico"], ["proposta", "Proposta"], ["cliente", "Clientes"]];
  const valores = etapas.map(([e]) => (e === "novo" ? n : lista.filter((p) => chegou(p, e)).length));
  const funil = document.getElementById("funil");
  funil.replaceChildren(...etapas.map(([, nome], i) => {
    const li = el("li", {}, el("span", {}, nome), el("span", { class: "trilho" }, el("i", { style: `width:${pct(valores[i], n || 1)}%` })), el("b", {}, valores[i]));
    if (i > 0) li.append(el("span", { class: "taxa" }, `${pct(valores[i], valores[i - 1])}% da etapa anterior`));
    return li;
  }));

  barras("por-nicho", contarPor(lista, "tipo"));
  barras("por-canal", contarPor(lista, "origem"));
  barras("por-dor", contarPor(lista, "dor"));
  desenharTabela();
}

function barras(id, pares) {
  const ul = document.getElementById(id);
  if (!pares.length) { ul.replaceChildren(el("li", { class: "nada" }, "Sem dados ainda")); return; }
  const max = pares[0][1];
  ul.replaceChildren(...pares.slice(0, 6).map(([k, v]) =>
    el("li", {}, el("div", { class: "rot" }, el("span", { title: k }, k), el("b", {}, v)), el("div", { class: "trilho" }, el("i", { style: `width:${pct(v, max)}%` })))
  ));
}

function filtrados() {
  return noPeriodo(todosPedidos()).filter((p) =>
    (!estadoUI.procurar || `${p.nome} ${p.negocio}`.toLowerCase().includes(estadoUI.procurar)) &&
    (!estadoUI.fEstado || p.estado === estadoUI.fEstado) &&
    (!estadoUI.fPais || p.pais === estadoUI.fPais)
  );
}

const fmtData = (iso) => { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }); };
const soDigitos = (s) => String(s || "").replace(/\D/g, "");

function desenharTabela() {
  const lista = filtrados();
  document.getElementById("vazio").hidden = lista.length > 0;
  document.getElementById("linhas").replaceChildren(...lista.map((p) => {
    const sel = el("select", { class: "estado", "data-v": p.estado, "aria-label": `Estado de ${p.negocio}` });
    ESTADOS.forEach(([v, nome]) => sel.append(new Option(nome, v, false, v === p.estado)));
    sel.addEventListener("change", async () => {
      if (p.exemplo || modo !== "real") {
        const alterados = ler(CHAVE_ESTADOS, {});
        alterados[p.id] = sel.value;
        gravar(CHAVE_ESTADOS, alterados);
      } else {
        sel.disabled = true;
        const { error } = await sb.from("pedidos").update({ estado: sel.value }).eq("id", p.id);
        sel.disabled = false;
        if (error) { alert("Não foi possível mudar o estado. Tenta outra vez."); return; }
        const alvo = PEDIDOS_REAIS.find((x) => x.id === p.id);
        if (alvo) alvo.estado = sel.value;
      }
      desenhar();
    });

    sel.addEventListener("click", (e) => e.stopPropagation());
    const acoes = el("div", { class: "acoes" });
    acoes.addEventListener("click", (e) => e.stopPropagation());
    const tel = soDigitos(p.whatsapp);
    if (tel) acoes.append(el("a", { href: linkWhats(p), target: "_blank", rel: "noopener", title: "WhatsApp com mensagem pronta para o estado \"" + NOME_ESTADO[p.estado] + "\"", "aria-label": `WhatsApp de ${p.nome}` }, "WA"));
    if (p.email) acoes.append(el("a", { href: `mailto:${p.email}`, title: "Enviar email", "aria-label": `Email para ${p.nome}` }, "@"));
    const cobrar = el("button", { type: "button", title: "Criar link de pagamento", "aria-label": `Cobrar ${p.negocio}` }, p.pais === "Brasil" ? "R$" : "€");
    cobrar.addEventListener("click", () => abrirGaveta(p, "cobrar"));
    acoes.append(cobrar);

    const negocio = el("td", {}, el("strong", {}, p.negocio || "—"));
    if (p.exemplo) negocio.firstChild.after(el("span", { class: "tag" }, "exemplo"));
    negocio.append(el("small", {}, p.nome || ""));
    const pagos = todosPagamentos().filter((x) => x.pedido_id === p.id && x.estado === "pago");
    if (pagos.length) negocio.append(el("span", { class: "pago-mini", title: "Já pagou" }, dinheiro(pagos.reduce((a, x) => a + x.valor, 0), pagos[0].moeda)));

    const linha = el("tr", { tabIndex: 0, title: "Ver percurso e dados" },
      el("td", { class: "data" }, fmtData(p.data), p.vid ? el("span", { class: "tem-percurso", title: "Tem percurso no site" }) : ""),
      negocio,
      el("td", {}, p.tipo || "—"),
      el("td", {}, p.pais === "Brasil" ? "BR" : "PT"),
      el("td", {}, p.clientes || "—"),
      el("td", {}, p.dor || "—"),
      el("td", {}, p.origem || "—"),
      el("td", {}, sel),
      el("td", {}, acoes)
    );
    linha.addEventListener("click", () => abrirGaveta(p));
    linha.addEventListener("keydown", (e) => { if (e.key === "Enter") abrirGaveta(p); });
    return linha;
  }));
}

function exportarCSV() {
  const campos = ["data", "nome", "negocio", "tipo", "pais", "clientes", "dor", "origem", "whatsapp", "email", "estado"];
  // Evita que folhas de cálculo interpretem células como fórmulas.
  const celula = (v) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const linhas = filtrados().map((p) => campos.map((c) => celula(c === "estado" ? NOME_ESTADO[p.estado] : p[c])).join(";"));
  const blob = new Blob(["﻿" + [campos.join(";"), ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `oddwork-pedidos-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Visitas ----------
const CHAVE_EVENTOS = "oddwork-eventos-teste";

// Gerador simples com semente, para os dados de exemplo serem sempre iguais.
function aleatorio(semente) { let x = semente; return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646; }
const escolher = (r, lista) => lista[Math.floor(r() * lista.length)];

function gerarEventosExemplo() {
  const r = aleatorio(42);
  const ev = [];
  const canais = ["Instagram", "Instagram", "Instagram", "TikTok", "TikTok", "Direto", "Pesquisa", "Email", "YouTube", "WhatsApp"];
  const campanhas = ["", "", "", "reel-horas-perdidas", "live-domingo", "bio", "email-frio-1"];
  const aparelhos = [["Telemóvel", "Safari", "iOS"], ["Telemóvel", "Chrome", "Android"], ["Telemóvel", "Safari", "iOS"], ["Computador", "Chrome", "macOS"], ["Computador", "Chrome", "Windows"], ["Tablet", "Safari", "iOS"]];
  const seccoes = ["Para quem", "O que construímos", "Como funciona", "Preço", "Perguntas", "Formulário"];
  const ctas = ["cta-hero", "cta-hero", "cta-preco", "cta-topo", "cta-barra"];
  const campos = ["nome", "negocio", "tipo", "clientes", "dor", "whatsapp", "email", "origem", "consentimento"];
  const perguntas = ["Porque não usar um programa de agendamento pronto?", "Quanto tempo demora a implantação?", "O que inclui a mensalidade?", "E se eu quiser cancelar?", "Prometem mais vendas?"];
  const agora = Date.now();

  function sessao(vid, t0, primeira, visitas, final) {
    const sid = vid + "-s" + visitas;
    const [tipo, browser, so] = escolher(r, aparelhos);
    const canal = escolher(r, canais);
    const mercado = r() < 0.35 ? "br" : "pt";
    let t = t0;
    const add = (o) => { t += 4000 + r() * 40000; ev.push({ vid, sid, mercado, pagina: "/", exemplo: true, t: new Date(t).toISOString(), ...o }); };
    ev.push({ tipo: "visita-anonima", t: new Date(t).toISOString(), canal, aparelho: tipo, mercado, exemplo: true });
    add({ tipo: "sessao", primeira, visitas, origem: { canal, campanha: canal === "Instagram" || canal === "Email" ? escolher(r, campanhas) : "" }, aparelho: { tipo, browser, so } });
    add({ tipo: "pagina" });
    const fundo = final ? 6 : Math.floor(r() * 6) + 1;
    seccoes.slice(0, fundo).forEach((s) => add({ tipo: "secao", secao: s }));
    if (r() < 0.3 || final) add({ tipo: "pergunta", pergunta: escolher(r, perguntas) });
    if (r() < 0.25 || final) add({ tipo: "clique", alvo: escolher(r, ctas) });
    if (fundo === 6 && (r() < 0.45 || final)) {
      const ate = final ? campos.length : Math.floor(r() * campos.length) + 1;
      campos.slice(0, ate).forEach((c) => add({ tipo: "form-campo", campo: c }));
    }
    if (final) add({ tipo: "pedido" });
    add({ tipo: "saida", segundos: Math.round(20 + r() * 260), scroll: Math.round(fundo / 6 * 100) });
  }

  // Visitantes que não pediram
  for (let i = 0; i < 150; i++) {
    const vid = "exa" + i;
    const n = r() < 0.25 ? 2 : 1;
    let t = agora - r() * 30 * 864e5;
    for (let k = 1; k <= n; k++) { sessao(vid, t, k === 1, k, false); t += 864e5 * (1 + r() * 3); }
  }
  // Os pedidos de exemplo, com o percurso até ao pedido
  EXEMPLO.forEach((p) => {
    const fim = new Date(p.data).getTime();
    const n = 1 + Math.floor(r() * 3);
    for (let k = 1; k <= n; k++) sessao(p.vid, fim - (n - k) * 864e5 * (1 + r() * 2) - 600000, k === 1, k, k === n);
  });
  // Visitas de quem recusou: só contagem anónima
  for (let i = 0; i < 110; i++) ev.push({ tipo: "visita-anonima", t: new Date(agora - r() * 30 * 864e5).toISOString(), canal: escolher(r, canais), aparelho: escolher(r, aparelhos)[0], mercado: r() < 0.35 ? "br" : "pt", exemplo: true });
  // Escolhas no aviso de cookies
  for (let i = 0; i < 260; i++) { const a = r() < 0.62; ev.push({ tipo: "consentimento", estatisticas: a, marketing: a && r() < 0.6, t: new Date(agora - r() * 30 * 864e5).toISOString(), exemplo: true }); }
  return ev;
}
let EVENTOS_EXEMPLO = null;

function todosEventos() {
  const reais = modo === "real" ? EVENTOS_REAIS : [];
  if (!estadoUI.exemplo) return reais;
  EVENTOS_EXEMPLO ??= gerarEventosExemplo();
  return [...reais, ...EVENTOS_EXEMPLO];
}

function contarMapa(itens) {
  const m = new Map();
  itens.forEach((k) => { k = k || "Sem dados"; m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const NOME_CTA = { "cta-hero": "Botão do topo da página", "cta-preco": "Botão do preço", "cta-topo": "Botão do menu", "cta-barra": "Barra do telemóvel", "pais-pt": "Mudou para PT", "pais-br": "Mudou para BR" };
const NOME_CAMPO = { nome: "Nome", negocio: "Negócio", tipo: "Tipo de negócio", clientes: "Nº de clientes", dor: "Maior dor", whatsapp: "WhatsApp", email: "Email", origem: "Como conheceu", consentimento: "Aceitou contacto" };

function desenharVisitas() {
  const evs = noPeriodo(todosEventos().map((e) => ({ ...e, data: e.t })));
  const anon = evs.filter((e) => e.tipo === "visita-anonima");
  const sessoes = evs.filter((e) => e.tipo === "sessao");
  const visitantes = new Set(sessoes.map((e) => e.vid));
  const consent = evs.filter((e) => e.tipo === "consentimento");
  const aceitou = consent.filter((e) => e.estatisticas).length;
  const pedidos = evs.filter((e) => e.tipo === "pedido");
  const saidas = evs.filter((e) => e.tipo === "saida");
  const tempo = saidas.length ? Math.round(saidas.reduce((a, e) => a + (e.segundos || 0), 0) / saidas.length) : 0;

  const v = (k, t) => { document.querySelector(`[data-v="${k}"]`).textContent = t; };
  const nota = (k, t) => { document.querySelector(`[data-v-nota="${k}"]`).textContent = t; };
  v("vistas", anon.length);
  v("visitantes", visitantes.size);
  v("aceite", consent.length ? pct(aceitou, consent.length) + "%" : "—");
  nota("aceite", consent.length ? `${aceitou} de ${consent.length} escolhas` : "Ainda ninguém escolheu");
  v("conversao", visitantes.size ? (Math.round((pedidos.length / visitantes.size) * 1000) / 10).toLocaleString("pt-PT") + "%" : "—");
  nota("conversao", `${pedidos.length} pedido${pedidos.length === 1 ? "" : "s"} de ${visitantes.size} visitantes`);
  v("tempo", tempo >= 60 ? `${Math.floor(tempo / 60)}m${String(tempo % 60).padStart(2, "0")}` : `${tempo}s`);
  document.getElementById("resumo").textContent = `${sessoes.length} visita${sessoes.length === 1 ? "" : "s"} com estatísticas · ${anon.length} páginas vistas no total`;

  // Visitas por dia
  const dias = estadoUI.dias || Math.max(7, Math.ceil((Date.now() - Math.min(...sessoes.map((e) => new Date(e.t)), Date.now())) / 864e5));
  const porDia = Array.from({ length: dias }, (_, i) => { const d = new Date(Date.now() - (dias - 1 - i) * 864e5); return { chave: d.toISOString().slice(0, 10), d, n: 0 }; });
  const idx = Object.fromEntries(porDia.map((x, i) => [x.chave, i]));
  sessoes.forEach((e) => { const i = idx[e.t.slice(0, 10)]; if (i !== undefined) porDia[i].n++; });
  const maxDia = Math.max(1, ...porDia.map((x) => x.n));
  const col = document.getElementById("v-dias");
  col.replaceChildren(...porDia.map((x) => el("div", { class: "col" }, el("span", {}, `${x.d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}: ${x.n}`), el("i", { style: `height:${(x.n / maxDia) * 100}%` }))));
  const eixo = col.nextElementSibling?.classList.contains("colunas__eixo") ? col.nextElementSibling : col.after(el("div", { class: "colunas__eixo" })) || col.nextElementSibling;
  eixo.replaceChildren(el("span", {}, fmtData(porDia[0].d)), el("span", {}, "Hoje"));

  barras("v-canal", contarMapa(sessoes.map((e) => e.origem?.canal)));
  const comSecao = (s) => new Set(evs.filter((e) => e.tipo === "secao" && e.secao === s).map((e) => e.sid)).size;
  barras("v-secoes", ["Para quem", "O que construímos", "Como funciona", "Preço", "Perguntas", "Formulário"].map((s) => [s, comSecao(s)]).filter((x) => x[1]));
  barras("v-cliques", contarMapa(evs.filter((e) => e.tipo === "clique").map((e) => NOME_CTA[e.alvo] || e.alvo)));
  barras("v-perguntas", contarMapa(evs.filter((e) => e.tipo === "pergunta").map((e) => e.pergunta)));
  barras("v-aparelho", contarMapa(sessoes.map((e) => e.aparelho?.tipo)));
  barras("v-pais", contarMapa(sessoes.map((e) => (e.mercado === "br" ? "Brasil" : "Portugal"))));
  barras("v-browser", contarMapa(sessoes.map((e) => e.aparelho ? `${e.aparelho.browser} · ${e.aparelho.so}` : "")));
  barras("v-campanha", contarMapa(sessoes.map((e) => e.origem?.campanha).filter(Boolean)));

  // Funil do formulário
  const campos = Object.keys(NOME_CAMPO);
  const porCampo = campos.map((c) => new Set(evs.filter((e) => e.tipo === "form-campo" && e.campo === c).map((e) => e.sid)).size);
  const totalForm = porCampo[0] || 0;
  const enviados = new Set(pedidos.map((e) => e.sid)).size;
  const linhas = campos.map((c, i) => [NOME_CAMPO[c], porCampo[i]]).concat([["Enviou o pedido", enviados]]);
  document.getElementById("v-form").replaceChildren(...(totalForm ? linhas.map(([nome, n], i) => {
    const li = el("li", {}, el("span", {}, nome), el("span", { class: "trilho" }, el("i", { style: `width:${pct(n, totalForm)}%` })), el("b", {}, n));
    if (i > 0 && linhas[i - 1][1] - n > 0) li.append(el("span", { class: "taxa" }, `${linhas[i - 1][1] - n} desistiram aqui`));
    return li;
  }) : [el("li", { class: "nada" }, "Ainda ninguém começou o formulário")]));
}

// ---------- Abas ----------
document.querySelectorAll("[data-aba]").forEach((b) =>
  b.addEventListener("click", () => {
    estadoUI.aba = b.dataset.aba;
    document.querySelectorAll("[data-aba]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    document.getElementById("vista-pedidos").hidden = estadoUI.aba !== "pedidos";
    document.getElementById("vista-visitas").hidden = estadoUI.aba !== "visitas";
    document.getElementById("vista-pagamentos").hidden = estadoUI.aba !== "pagamentos";
    document.querySelector(".periodo").hidden = estadoUI.aba === "pagamentos";
    desenhar();
  })
);

// ---------- Gaveta: dados e percurso de um pedido ----------
const gaveta = document.getElementById("gaveta");
const gavetaFundo = document.getElementById("gaveta-fundo");
let focoAntes = null;

function descreverEvento(e) {
  switch (e.tipo) {
    case "sessao": return [`${e.primeira ? "Primeira visita" : `Voltou (visita ${e.visitas})`} · ${e.origem?.canal || "?"}${e.origem?.campanha ? ` · ${e.origem.campanha}` : ""}`, "sessao", e.aparelho ? `${e.aparelho.tipo}, ${e.aparelho.browser}` : ""];
    case "secao": return [`Viu: ${e.secao}`, ""];
    case "clique": return [`Clicou: ${NOME_CTA[e.alvo] || e.alvo}`, "forte"];
    case "pergunta": return [`Abriu a pergunta: ${e.pergunta}`, ""];
    case "form-campo": return null; // resumido abaixo
    case "pedido": return ["Enviou o pedido de diagnóstico", "forte"];
    case "saida": return [`Saiu depois de ${e.segundos}s · desceu ${e.scroll}% da página`, ""];
    default: return null;
  }
}

function abrirGaveta(p, foco) {
  focoAntes = document.activeElement;
  document.getElementById("gaveta-titulo").textContent = p.negocio || "—";
  document.getElementById("gaveta-sub").textContent = `${p.nome || ""} · ${p.pais || ""}`;
  const dados = [["Pedido", new Date(p.data).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })], ["Tipo", p.tipo], ["Clientes", p.clientes], ["Maior dor", p.dor], ["Disse que veio de", p.origem], ["WhatsApp", p.whatsapp], ["Email", p.email], ["Estado", NOME_ESTADO[p.estado]]];
  document.getElementById("gaveta-dados").replaceChildren(...dados.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v || "—")]));

  const evs = p.vid ? todosEventos().filter((e) => e.vid === p.vid && e.tipo !== "pagina").sort((a, b) => a.t.localeCompare(b.t)) : [];
  const ol = document.getElementById("gaveta-percurso");
  if (!evs.length) {
    ol.replaceChildren(el("li", { class: "sem" }, p.vid ? "Sem eventos guardados." : "Esta pessoa não aceitou as estatísticas, por isso não há percurso."));
  } else {
    const itens = [];
    let campos = [];
    const fecharCampos = () => { if (campos.length) { itens.push(el("li", {}, `Preencheu o formulário: ${campos.map((c) => NOME_CAMPO[c] || c).join(", ")}`)); campos = []; } };
    evs.forEach((e) => {
      if (e.tipo === "form-campo") { campos.push(e.campo); return; }
      fecharCampos();
      const d = descreverEvento(e);
      if (!d) return;
      const li = el("li", { class: d[1] }, el("time", {}, new Date(e.t).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })), d[0]);
      if (d[2]) li.append(el("small", { style: "display:block;color:var(--suave)" }, d[2]));
      itens.push(li);
    });
    fecharCampos();
    ol.replaceChildren(...itens);
  }
  desenharPagamentos(p);
  gaveta.hidden = false; gavetaFundo.hidden = false;
  if (foco === "cobrar") {
    const caixa = document.getElementById("gaveta-pagamentos");
    caixa.scrollIntoView({ block: "start" });
    (document.getElementById("cob-tipo") || document.getElementById("gaveta-fechar")).focus();
  } else document.getElementById("gaveta-fechar").focus();
}
function fecharGaveta() { gaveta.hidden = true; gavetaFundo.hidden = true; focoAntes?.focus?.(); }
document.getElementById("gaveta-fechar").addEventListener("click", fecharGaveta);
gavetaFundo.addEventListener("click", fecharGaveta);
addEventListener("keydown", (e) => { if (e.key === "Escape" && !gaveta.hidden) fecharGaveta(); });

// ---------- Pagamentos (Stripe) ----------
// Preços do catálogo, em cêntimos. O preço normal no Brasil depende da proposta: indica-se o valor.
const PRECOS = {
  Portugal: { fundador: { implantacao: 45000, mensalidade: 10000 }, normal: { implantacao: 75000, mensalidade: 13000 } },
  Brasil: { fundador: { implantacao: 100000, mensalidade: 35000 }, normal: { implantacao: null, mensalidade: null } },
};
const NOME_TIPO_PAG = { "implantacao-1": "Implantação · 1.ª metade", "implantacao-2": "Implantação · 2.ª metade", mensalidade: "Mensalidade", renovacao: "Mensalidade (renovação)", outro: "Outro" };
const NOME_ESTADO_PAG = { link_criado: "Link enviado", pendente: "A aguardar", pago: "Pago", falhou: "Falhou", expirado: "Expirou", reembolsado: "Reembolsado", disputa: "Em disputa", cancelado: "Cancelado" };
const dinheiro = (cent, moeda) => (cent / 100).toLocaleString(moeda === "brl" ? "pt-BR" : "pt-PT", { style: "currency", currency: moeda.toUpperCase() });

function listaPagamentos(p) {
  const moeda = p.pais === "Brasil" ? "brl" : "eur";
  const lista = todosPagamentos().filter((x) => x.pedido_id === p.id);
  const pago = lista.filter((x) => x.estado === "pago").reduce((a, x) => a + x.valor, 0);
  const ul = el("ul", { class: "pagamentos__lista" });
  if (!lista.length) ul.append(el("li", { class: "sem" }, "Ainda não há cobranças para este pedido."));
  lista.forEach((x) => {
    const li = el("li", {},
      el("div", {}, el("strong", {}, NOME_TIPO_PAG[x.tipo] || x.tipo), el("small", {}, new Date(x.criado).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }) + " · " + dinheiro(x.valor, x.moeda))),
      el("span", { class: "selo selo--" + x.estado }, NOME_ESTADO_PAG[x.estado] || x.estado));
    if (x.url && x.estado === "link_criado") li.append(botaoCopiar(linkCurto(x), "Copiar link"));
    if (!x.exemplo && modo === "real" && ESPERA.includes(x.estado) && x.stripe_sessao) li.append(botaoCancelar(x, p));
    ul.append(li);
  });
  if (pago) ul.append(el("li", { class: "pagamentos__total" }, "Recebido: ", el("strong", {}, dinheiro(pago, moeda))));
  return ul;
}

function desenharPagamentos(p) {
  const caixa = document.getElementById("gaveta-pagamentos");
  const brasil = p.pais === "Brasil";
  const moeda = brasil ? "brl" : "eur";
  const lista = todosPagamentos().filter((x) => x.pedido_id === p.id);
  const ul = listaPagamentos(p);

  if (modo !== "real" || p.exemplo) {
    caixa.replaceChildren(ul, el("p", { class: "pagamentos__nota" }, "Para criar links de pagamento, entra com a palavra-passe (não funciona com dados de exemplo)."));
    return;
  }

  // Formulário "Cobrar"
  const tipo = el("select", { id: "cob-tipo" }, ...["implantacao-1", "implantacao-2", "mensalidade"].map((t) => new Option(NOME_TIPO_PAG[t], t)));
  const jaPagas = new Set(lista.filter((x) => x.estado === "pago").map((x) => x.tipo));
  tipo.value = !jaPagas.has("implantacao-1") ? "implantacao-1" : !jaPagas.has("implantacao-2") ? "implantacao-2" : "mensalidade";
  const plano = el("select", { id: "cob-plano" }, new Option("Fundador", "fundador"), new Option("Normal", "normal"));
  const valor = el("input", { id: "cob-valor", type: "number", min: "1", step: "0.01", inputMode: "decimal" });
  const ajuda = el("small", { class: "pagamentos__ajuda" });
  const botao = el("button", { type: "submit", class: "botao" }, "Criar link de pagamento");
  const resultado = el("div", { class: "pagamentos__resultado", hidden: true });
  const erroEl = el("p", { class: "pagamentos__erro", hidden: true, role: "alert" });

  const atualizar = () => {
    const chave = tipo.value === "mensalidade" ? "mensalidade" : "implantacao";
    const base = PRECOS[brasil ? "Brasil" : "Portugal"][plano.value][chave];
    valor.placeholder = base ? (base / 100).toString() : "valor da proposta";
    valor.required = !base;
    ajuda.textContent = base
      ? "Preço do catálogo: " + dinheiro(base, moeda) + (chave === "mensalidade" ? " por mês" : "") + ". Deixa vazio para usar este valor."
      : "Sem preço fixo: escreve o valor da proposta em " + moeda.toUpperCase() + (chave === "mensalidade" ? " por mês." : ".");
    if (brasil && chave === "mensalidade") ajuda.textContent += " No Brasil pode ser Pix Automático ou cartão. No Pix, o IOF já fica incluído: o cliente paga exatamente este valor.";
  };
  tipo.addEventListener("change", atualizar);
  plano.addEventListener("change", atualizar);
  atualizar();

  const form = el("form", { class: "pagamentos__form" },
    el("label", {}, "O que cobrar", tipo),
    el("label", {}, "Plano", plano),
    el("label", { class: "largo" }, "Valor em " + moeda.toUpperCase() + " (opcional)", valor, ajuda),
    botao, erroEl);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroEl.hidden = true; resultado.hidden = true;
    const corpo = { pedido_id: p.id, tipo: tipo.value, plano: plano.value };
    if (valor.value) corpo.valor = Math.round(Number(valor.value) * 100);
    botao.disabled = true; botao.textContent = "A criar…";
    try {
      const { data, error } = await sb.functions.invoke("cobrar", { body: corpo });
      if (error) {
        let msg = "Não foi possível criar o link.";
        try { msg = (await error.context.json()).erro || msg; } catch { /* sem detalhe */ }
        throw new Error(msg);
      }
      PAGAMENTOS_REAIS = await lerTudo("pagamentos", "criado");
      const novo = PAGAMENTOS_REAIS.find((y) => y.url === data.url)
        || { tipo: corpo.tipo, valor: corpo.valor || 0, moeda: brasil ? "brl" : "eur", url: data.url, codigo: data.codigo };
      mostrarLink(resultado, novo, p);
      caixa.querySelector(".pagamentos__lista")?.replaceWith(listaPagamentos(p));
    } catch (err) {
      erroEl.textContent = err.message; erroEl.hidden = false;
    } finally {
      botao.disabled = false; botao.textContent = "Criar link de pagamento";
    }
  });

  caixa.replaceChildren(ul, form, resultado);
}

function botaoCopiar(texto, rotulo) {
  const b = el("button", { type: "button", class: "botao botao--fantasma botao--pequeno" }, rotulo);
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(texto); b.textContent = "Copiado"; } catch { prompt("Copia o link:", texto); }
    setTimeout(() => { b.textContent = rotulo; }, 1800);
  });
  return b;
}

// Cancela um link por pagar. O Stripe avisa o webhook, que marca "Expirou"; o painel espera por isso.
function botaoCancelar(x, p) {
  const b = el("button", { type: "button", class: "botao botao--fantasma botao--pequeno", title: "O link deixa de funcionar" }, "Cancelar");
  b.addEventListener("click", async () => {
    if (!confirm("Cancelar este link de " + dinheiro(x.valor, x.moeda) + "? Deixa de dar para pagar com ele.")) return;
    b.disabled = true; b.textContent = "A cancelar…";
    try {
      const { error } = await sb.functions.invoke("cobrar", { body: { cancelar: x.id } });
      if (error) {
        let msg = "Não foi possível cancelar.";
        try { msg = (await error.context.json()).erro || msg; } catch { /* sem detalhe */ }
        throw new Error(msg);
      }
      b.textContent = "A confirmar…";
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        PAGAMENTOS_REAIS = await lerTudo("pagamentos", "criado");
        if (PAGAMENTOS_REAIS.find((y) => y.id === x.id)?.estado === "expirado") break;
      }
      document.querySelector("#gaveta-pagamentos .pagamentos__lista")?.replaceWith(listaPagamentos(p));
      desenhar();
    } catch (err) {
      alert(err.message);
      b.disabled = false; b.textContent = "Cancelar";
    }
  });
  return b;
}

// Depois de criar o link: link curto + mensagem pronta (e editável) para este cliente.
function mostrarLink(caixa, x, p) {
  const tel = soDigitos(p.whatsapp);
  const curto = linkCurto(x);
  const texto = el("textarea", { class: "pagamentos__mensagem", rows: 8, "aria-label": "Mensagem para o cliente" });
  texto.value = mensagemPagamento(p, x, "link");
  const enviar = el("button", { type: "button", class: "botao botao--pequeno" }, tel ? "Enviar por WhatsApp" : "Abrir no WhatsApp");
  enviar.addEventListener("click", () => {
    window.open("https://wa.me/" + (tel || "") + "?text=" + encodeURIComponent(texto.value), "_blank", "noopener");
  });
  const copiarMsg = el("button", { type: "button", class: "botao botao--fantasma botao--pequeno" }, "Copiar mensagem");
  copiarMsg.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(texto.value); copiarMsg.textContent = "Copiada"; } catch { texto.select(); }
    setTimeout(() => { copiarMsg.textContent = "Copiar mensagem"; }, 1800);
  });
  caixa.replaceChildren(
    el("strong", {}, "Link criado"),
    el("input", { type: "text", readOnly: true, value: curto, "aria-label": "Link de pagamento" }),
    el("label", { class: "pagamentos__rotulo" }, "Mensagem para " + ((p.nome || "").split(" ")[0] || "o cliente") + " (podes editar antes de enviar)", texto),
    el("div", { class: "pagamentos__acoes" },
      enviar,
      copiarMsg,
      botaoCopiar(curto, "Copiar link"),
      el("a", { class: "botao botao--fantasma botao--pequeno", href: curto, target: "_blank", rel: "noopener" }, "Abrir")));
  caixa.hidden = false;
}

// ---------- Dinheiro, "Fazer hoje" e lista de pagamentos ----------
// Pagamentos de exemplo, ligados aos pedidos de exemplo (só para testar o painel).
function gerarPagamentosExemplo() {
  const dia = 864e5, agora = Date.now();
  const ped = (i) => EXEMPLO[i];
  const linha = (i, tipo, valor, estado, diasAtras) => {
    const p = ped(i), moeda = p.pais === "Brasil" ? "brl" : "eur";
    const t = new Date(agora - diasAtras * dia).toISOString();
    return { id: "exp" + i + tipo + diasAtras, pedido_id: p.id, tipo, valor: moeda === "brl" && valor < 100000 ? valor * 3.5 : valor, moeda, estado, criado: t, atualizado: t, url: "https://checkout.stripe.com/exemplo", exemplo: true };
  };
  return [
    linha(7, "implantacao-1", 45000, "pago", 20), linha(7, "mensalidade", 10000, "pago", 6), linha(7, "implantacao-2", 45000, "pago", 5),
    linha(6, "implantacao-1", 45000, "link_criado", 4), linha(13, "implantacao-1", 45000, "link_criado", 1),
    linha(3, "mensalidade", 10000, "falhou", 2), linha(3, "implantacao-1", 100000, "pago", 30),
  ];
}
const PAGAMENTOS_EXEMPLO = gerarPagamentosExemplo();
function todosPagamentos() {
  const reais = modo === "real" ? PAGAMENTOS_REAIS : [];
  return (estadoUI.exemplo ? [...reais, ...PAGAMENTOS_EXEMPLO] : reais).slice().sort((a, b) => (b.criado || "").localeCompare(a.criado || ""));
}
const pedidoDe = (pag) => todosPedidos().find((p) => p.id === pag.pedido_id) || {};
const quando = (x) => x.atualizado || x.criado;
const ESPERA = ["link_criado", "pendente"];

// Soma por moeda e escreve "120 € · R$ 350,00".
function somar(lista) {
  const m = {};
  lista.forEach((x) => { m[x.moeda] = (m[x.moeda] || 0) + x.valor; });
  const partes = Object.entries(m).sort(([a], [b]) => (a === "eur" ? -1 : b === "eur" ? 1 : 0)).map(([moeda, v]) => dinheiro(v, moeda));
  return partes.length ? partes.join(" · ") : dinheiro(0, "eur");
}

// Mensalidade ativa = a última mensalidade (ou renovação) paga de cada cliente, se não foi cancelada depois.
function mensalidadesAtivas() {
  const porPedido = new Map();
  todosPagamentos().filter((x) => ["mensalidade", "renovacao"].includes(x.tipo)).forEach((x) => {
    const lista = porPedido.get(x.pedido_id) || [];
    lista.push(x); porPedido.set(x.pedido_id, lista);
  });
  const ativas = [];
  porPedido.forEach((lista) => {
    lista.sort((a, b) => quando(b).localeCompare(quando(a)));
    if (lista.some((x) => x.estado === "cancelado")) return;
    const ultimaPaga = lista.find((x) => x.estado === "pago");
    if (ultimaPaga) ativas.push(ultimaPaga);
  });
  return ativas;
}

function desenharDinheiro() {
  const pags = todosPagamentos();
  const pagos = pags.filter((x) => x.estado === "pago");
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const doMes = pagos.filter((x) => new Date(quando(x)) >= inicioMes);
  const espera = pags.filter((x) => ESPERA.includes(x.estado));
  const ativas = mensalidadesAtivas();
  // Uma linha por moeda, para € e R$ não ficarem colados.
  const set = (k, v) => { document.querySelector(`[data-din="${k}"]`).replaceChildren(...v.split(" · ").map((t) => el("span", {}, t))); };
  const nota = (k, v) => { document.querySelector(`[data-din-nota="${k}"]`).textContent = v; };
  set("mes", somar(doMes)); nota("mes", doMes.length ? `${doMes.length} pagamento${doMes.length === 1 ? "" : "s"} em ${inicioMes.toLocaleDateString("pt-PT", { month: "long" })}` : "Ainda nada este mês");
  set("mensal", somar(ativas)); nota("mensal", ativas.length ? `${ativas.length} cliente${ativas.length === 1 ? "" : "s"} com mensalidade ativa` : "Nenhuma mensalidade ativa");
  set("espera", somar(espera)); nota("espera", espera.length ? `${espera.length} link${espera.length === 1 ? "" : "s"} por pagar` : "Nada pendente");
  set("total", somar(pagos)); nota("total", `${pagos.length} pagamento${pagos.length === 1 ? "" : "s"} recebido${pagos.length === 1 ? "" : "s"}`);
  document.querySelector(".dinheiro__item--espera").classList.toggle("zero", !espera.length);
}

// Mensagens prontas para o WhatsApp, conforme o estado do pedido.
// Link curto do pagamento (theoddwork.com/p/?CODIGO). Os antigos, sem código, usam o link do Stripe.
const linkCurto = (x) => (x?.codigo ? "https://theoddwork.com/p/?" + x.codigo : x?.url || "");

// Mensagem personalizada para cada cobrança: nome, negócio, o que se paga e o valor.
function mensagemPagamento(p, x, caso = "link") {
  const br = p.pais === "Brasil";
  const nome = (p.nome || "").split(" ")[0];
  const ola = nome ? (br ? `Oi ${nome}, tudo bem?` : `Olá ${nome}!`) : (br ? "Oi, tudo bem?" : "Olá!");
  const neg = p.negocio || (br ? "seu negócio" : "o teu negócio");
  const mensal = x.tipo === "mensalidade" || x.tipo === "renovacao";
  const valor = dinheiro(x.valor, x.moeda) + (mensal ? "/mês" : "");
  const oque = {
    "implantacao-1": br ? "a 1ª metade da implantação" : "a 1.ª metade da implantação",
    "implantacao-2": br ? "a 2ª metade da implantação" : "a 2.ª metade da implantação",
    mensalidade: "a mensalidade",
    renovacao: "a mensalidade",
  }[x.tipo] || (br ? "o pagamento" : "o pagamento");
  const link = linkCurto(x);
  const meios = br ? "Você pode pagar por Pix ou cartão." : "Podes pagar com cartão ou MB WAY.";

  if (caso === "lembrete") {
    return br
      ? `${ola} Passando só para lembrar ${oque} do sistema de ${neg} (${valor}). O link continua aqui:\n${link}\n\nSe já pagou, pode ignorar esta mensagem. Qualquer dúvida, é só me chamar.`
      : `${ola} Passo só para lembrar ${oque} do sistema de ${neg} (${valor}). O link continua aqui:\n${link}\n\nSe já pagaste, ignora esta mensagem. Qualquer dúvida, diz-me.`;
  }
  if (caso === "falhou") {
    return br
      ? `${ola} O pagamento d${oque} (${valor}) não passou. Às vezes é o banco que bloqueia compras internacionais. Me avisa quando puder que eu envio um link novo, e você pode usar outro cartão ou Pix.`
      : `${ola} O pagamento d${oque} (${valor}) não passou. Às vezes é o banco que bloqueia compras online. Diz-me quando puderes e envio-te um link novo, para tentares com outro cartão ou com MB WAY.`;
  }
  if (x.tipo === "implantacao-1") {
    return br
      ? `${ola} Obrigado por fechar com a Oddwork! Para começarmos o sistema de ${neg}, aqui está o link para pagar ${oque} (${valor}):\n${link}\n\n${meios} O pagamento é seguro, pelo Stripe, e o recibo chega no seu e-mail logo em seguida. Qualquer dúvida, é só me chamar.`
      : `${ola} Obrigado por avançares com a Oddwork! Para começarmos o sistema de ${neg}, aqui está o link para pagar ${oque} (${valor}):\n${link}\n\n${meios} O pagamento é seguro, pelo Stripe, e recebes o recibo por e-mail logo a seguir. Qualquer dúvida, diz-me.`;
  }
  if (x.tipo === "implantacao-2") {
    return br
      ? `${ola} O sistema de ${neg} está entregue e funcionando. Aqui está o link para ${oque} (${valor}):\n${link}\n\n${meios} O recibo chega no seu e-mail logo em seguida. Obrigado pela confiança!`
      : `${ola} O sistema de ${neg} está entregue e a funcionar. Aqui está o link para ${oque} (${valor}):\n${link}\n\n${meios} Recebes o recibo por e-mail logo a seguir. Obrigado pela confiança!`;
  }
  if (mensal) {
    return br
      ? `${ola} Aqui está o link para ativar a mensalidade de ${neg} (${valor}):\n${link}\n\nSó precisa fazer isso uma vez: depois a cobrança é automática todo mês, com recibo no seu e-mail. Você pode cancelar quando quiser.`
      : `${ola} Aqui está o link para ativar a mensalidade de ${neg} (${valor}):\n${link}\n\nSó precisas de fazer isto uma vez: a partir daí a cobrança é automática todos os meses, com recibo por e-mail. Podes cancelar quando quiseres.`;
  }
  return br
    ? `${ola} Aqui está o link para o pagamento de ${neg} (${valor}):\n${link}\n\n${meios} O recibo chega no seu e-mail logo em seguida.`
    : `${ola} Aqui está o link para o pagamento de ${neg} (${valor}):\n${link}\n\n${meios} Recebes o recibo por e-mail logo a seguir.`;
}

function textoWhats(p, extra = {}) {
  const br = p.pais === "Brasil";
  const nome = (p.nome || "").split(" ")[0];
  const ola = (br ? "Oi " : "Olá ") + nome + (br ? ", aqui é da Oddwork." : ", é a Oddwork.");
  if (extra.x) return mensagemPagamento(p, extra.x, extra.tipo);
  const porEstado = {
    novo: br ? `Recebemos seu pedido de diagnóstico para ${p.negocio || "o seu negócio"}. Qual o melhor dia e horário para a chamada de 20 minutos?` : `Recebemos o teu pedido de diagnóstico para ${p.negocio || "o teu negócio"}. Que dia e hora te dá jeito para a chamada de 20 minutos?`,
    contactado: br ? "Só para confirmar a chamada de diagnóstico: qual dia e horário funcionam para você?" : "Só para confirmar a chamada de diagnóstico: que dia e hora te dão jeito?",
    diagnostico: br ? "Obrigado pela conversa! Estamos preparando a proposta e enviamos em até 48 horas." : "Obrigado pela conversa! Estamos a preparar a proposta e enviamo-la em até 48 horas.",
    proposta: br ? "Conseguiu ver a proposta? Se tiver qualquer dúvida, é só me dizer." : "Conseguiste ver a proposta? Se tiveres alguma dúvida, diz-me.",
    cliente: br ? "Está tudo funcionando bem com o sistema?" : "Está tudo a correr bem com o sistema?",
    perdido: br ? "Passando para saber se faz sentido voltarmos a conversar." : "Passo só para saber se faz sentido voltarmos a falar.",
  };
  return `${ola} ${porEstado[p.estado] || ""}`.trim();
}
const linkWhats = (p, extra) => `https://wa.me/${soDigitos(p.whatsapp)}?text=${encodeURIComponent(textoWhats(p, extra))}`;

function desenharHoje() {
  const agora = Date.now(), dia = 864e5;
  const dias = (iso) => Math.floor((agora - new Date(iso).getTime()) / dia);
  const haDias = (n) => (n <= 0 ? "hoje" : n === 1 ? "há 1 dia" : `há ${n} dias`);
  const itens = [];
  todosPedidos().filter((p) => p.estado === "novo").forEach((p) => {
    itens.push({ peso: 3 + dias(p.data), cor: dias(p.data) >= 1 ? "verm" : "lar", p, titulo: `Responder a ${p.negocio || p.nome}`, sub: `Pediu diagnóstico ${haDias(dias(p.data))}`, whats: p.whatsapp ? linkWhats(p) : "" });
  });
  todosPagamentos().filter((x) => x.estado === "falhou").forEach((x) => {
    const p = pedidoDe(x);
    itens.push({ peso: 10, cor: "verm", p, titulo: `Pagamento falhou: ${p.negocio || "—"}`, sub: `${NOME_TIPO_PAG[x.tipo] || x.tipo} · ${dinheiro(x.valor, x.moeda)}`, whats: p.whatsapp ? linkWhats(p, { tipo: "falhou", x }) : "" });
  });
  todosPagamentos().filter((x) => ESPERA.includes(x.estado) && dias(x.criado) >= 2).forEach((x) => {
    const p = pedidoDe(x);
    itens.push({ peso: 2 + dias(x.criado), cor: "lar", p, titulo: `Lembrar ${p.negocio || "—"} de pagar`, sub: `${NOME_TIPO_PAG[x.tipo] || x.tipo} · ${dinheiro(x.valor, x.moeda)} · link enviado ${haDias(dias(x.criado))}`, whats: p.whatsapp && x.url ? linkWhats(p, { tipo: "lembrete", x }) : "" });
  });
  todosPedidos().filter((p) => p.estado === "proposta" && dias(p.data) >= 4 && !todosPagamentos().some((x) => x.pedido_id === p.id)).forEach((p) => {
    itens.push({ peso: 1, cor: "cinza", p, titulo: `Seguir a proposta de ${p.negocio || p.nome}`, sub: "Proposta enviada, ainda sem pagamento", whats: p.whatsapp ? linkWhats(p) : "" });
  });
  itens.sort((a, b) => b.peso - a.peso);
  document.getElementById("hoje-conta").textContent = itens.length;
  document.getElementById("hoje-conta").classList.toggle("zero", !itens.length);
  const ul = document.getElementById("hoje-lista");
  if (!itens.length) { ul.replaceChildren(el("li", { class: "hoje__vazio" }, "Nada pendente. Tudo respondido e sem pagamentos atrasados.")); return; }
  ul.replaceChildren(...itens.slice(0, 8).map((it) => {
    const abrir = el("button", { type: "button", class: "hoje__abrir" }, el("span", { class: "ponto ponto--" + it.cor }), el("span", {}, el("strong", {}, it.titulo), el("small", {}, it.sub)));
    if (it.p.id) abrir.addEventListener("click", () => abrirGaveta(it.p));
    const li = el("li", {}, abrir);
    if (it.whats) li.append(el("a", { class: "botao botao--pequeno", href: it.whats, target: "_blank", rel: "noopener", title: "Abre o WhatsApp com a mensagem já escrita" }, "WhatsApp"));
    return li;
  }));
  if (itens.length > 8) ul.append(el("li", { class: "hoje__mais" }, `E mais ${itens.length - 8}.`));
}

// ---------- Separador Pagamentos ----------
const pagUI = { procurar: "", estado: "", mes: "", moeda: "" };
const chaveMes = (iso) => iso.slice(0, 7);
function pagamentosFiltrados() {
  return todosPagamentos().filter((x) => {
    const p = pedidoDe(x);
    if (pagUI.procurar && !`${p.negocio} ${p.nome}`.toLowerCase().includes(pagUI.procurar)) return false;
    if (pagUI.estado === "espera" ? !ESPERA.includes(x.estado) : pagUI.estado && x.estado !== pagUI.estado) return false;
    if (pagUI.mes && chaveMes(quando(x)) !== pagUI.mes) return false;
    if (pagUI.moeda && x.moeda !== pagUI.moeda) return false;
    return true;
  });
}
function desenharListaPagamentos() {
  document.getElementById("faixa-exemplo").hidden = !estadoUI.exemplo;
  // Meses disponíveis no filtro
  const selMes = document.getElementById("pag-mes");
  const meses = [...new Set(todosPagamentos().map((x) => chaveMes(quando(x))))].sort().reverse();
  const atual = selMes.value;
  selMes.replaceChildren(new Option("Todos os meses", ""), ...meses.map((m) => new Option(new Date(m + "-01T12:00").toLocaleDateString("pt-PT", { month: "long", year: "numeric" }), m)));
  selMes.value = meses.includes(atual) ? atual : pagUI.mes = "";
  const lista = pagamentosFiltrados();
  const pagos = lista.filter((x) => x.estado === "pago");
  document.getElementById("resumo").textContent = `${todosPagamentos().length} pagamento${todosPagamentos().length === 1 ? "" : "s"} registado${todosPagamentos().length === 1 ? "" : "s"}`;
  const emEspera = lista.filter((x) => ESPERA.includes(x.estado));
  document.getElementById("pag-totais").textContent = lista.length ? [`${lista.length} na lista`, pagos.length ? "recebido: " + somar(pagos) : "", emEspera.length ? "à espera: " + somar(emEspera) : ""].filter(Boolean).join(" · ") : "";
  document.getElementById("pag-vazio").hidden = lista.length > 0;
  document.getElementById("pag-linhas").replaceChildren(...lista.map((x) => {
    const p = pedidoDe(x);
    const acoes = el("div", { class: "acoes" });
    if (x.url && ESPERA.includes(x.estado)) {
      acoes.append(botaoCopiar(linkCurto(x), "Copiar link"));
      if (p.whatsapp) acoes.append(el("a", { class: "acoes__texto", href: linkWhats(p, { tipo: "lembrete", x }), target: "_blank", rel: "noopener", title: "Lembrar pelo WhatsApp" }, "Lembrar"));
    }
    if (x.estado === "falhou" && p.whatsapp) acoes.append(el("a", { class: "acoes__texto", href: linkWhats(p, { tipo: "falhou", x }), target: "_blank", rel: "noopener" }, "Avisar"));
    const negocio = el("td", {}, el("strong", {}, p.negocio || "—"), el("small", {}, p.nome || ""));
    if (x.exemplo) negocio.firstChild.after(el("span", { class: "tag" }, "exemplo"));
    const tr = el("tr", { tabIndex: 0, title: "Abrir a ficha do pedido" },
      el("td", { class: "data" }, fmtData(quando(x))),
      negocio,
      el("td", {}, NOME_TIPO_PAG[x.tipo] || x.tipo),
      el("td", { class: "num" }, dinheiro(x.valor, x.moeda)),
      el("td", {}, el("span", { class: "selo selo--" + x.estado }, NOME_ESTADO_PAG[x.estado] || x.estado)),
      el("td", {}, acoes));
    acoes.addEventListener("click", (e) => e.stopPropagation());
    if (p.id) {
      tr.addEventListener("click", () => abrirGaveta(p));
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") abrirGaveta(p); });
    }
    return tr;
  }));
}
function exportarPagamentos() {
  const celula = (v) => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
  const cab = ["data", "negocio", "nome", "pais", "o_que", "valor", "moeda", "estado"];
  const linhas = pagamentosFiltrados().map((x) => {
    const p = pedidoDe(x);
    return [quando(x).slice(0, 10), p.negocio, p.nome, p.pais, NOME_TIPO_PAG[x.tipo] || x.tipo, (x.valor / 100).toFixed(2).replace(".", ","), x.moeda.toUpperCase(), NOME_ESTADO_PAG[x.estado] || x.estado].map(celula).join(";");
  });
  const blob = new Blob(["﻿" + [cab.join(";"), ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `oddwork-pagamentos-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}
const selPagEstado = document.getElementById("pag-estado");
selPagEstado.append(new Option("À espera de pagamento", "espera"), ...Object.entries(NOME_ESTADO_PAG).map(([v, n]) => new Option(n, v)));
selPagEstado.addEventListener("change", (e) => { pagUI.estado = e.target.value; desenharListaPagamentos(); });
document.getElementById("pag-mes").addEventListener("change", (e) => { pagUI.mes = e.target.value; desenharListaPagamentos(); });
document.getElementById("pag-moeda").addEventListener("change", (e) => { pagUI.moeda = e.target.value; desenharListaPagamentos(); });
document.getElementById("pag-procurar").addEventListener("input", (e) => { pagUI.procurar = e.target.value.trim().toLowerCase(); desenharListaPagamentos(); });
document.getElementById("pag-exportar").addEventListener("click", exportarPagamentos);

// Os cartões do dinheiro abrem a lista de pagamentos já filtrada.
document.querySelectorAll("[data-ir-pag]").forEach((b) => b.addEventListener("click", () => {
  const filtro = b.dataset.irPag;
  pagUI.estado = filtro === "espera" ? "espera" : filtro === "tudo" ? "" : "pago";
  pagUI.mes = filtro === "pago-mes" ? new Date().toISOString().slice(0, 7) : "";
  if (filtro === "mensal") pagUI.estado = "pago";
  selPagEstado.value = pagUI.estado;
  document.getElementById("aba-pagamentos").click();
  document.getElementById("pag-mes").value = pagUI.mes;
  desenharListaPagamentos();
}));

// ---------- Atualizar ----------
async function atualizarDados(silencioso) {
  if (modo !== "real") { desenhar(); return; }
  const b = document.getElementById("atualizar");
  if (!silencioso) { b.disabled = true; b.textContent = "A atualizar…"; }
  try { await carregarReais(); desenhar(); }
  catch { if (!silencioso) alert("Não foi possível atualizar. Verifica a ligação."); }
  finally { b.disabled = false; b.textContent = "Atualizar"; marcarHora(); }
}
function marcarHora() {
  const x = document.getElementById("atualizado");
  if (!ultimaCarga || modo !== "real") { x.textContent = ""; return; }
  const min = Math.floor((Date.now() - ultimaCarga) / 60000);
  x.textContent = min < 1 ? "Atualizado agora" : `Atualizado há ${min} min`;
}
document.getElementById("atualizar").addEventListener("click", () => atualizarDados(false));
// De minuto a minuto, com o separador visível e a gaveta fechada, vai buscar dados novos.
setInterval(() => {
  marcarHora();
  if (modo === "real" && document.visibilityState === "visible" && gaveta.hidden && Date.now() - ultimaCarga > 60000) atualizarDados(true);
}, 15000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && modo === "real" && Date.now() - ultimaCarga > 60000) atualizarDados(true); });

// ---------- Início ----------
if (sb) {
  sb.auth.getSession().then(({ data }) => { if (data.session) entrarReal(); });
  sb.auth.onAuthStateChange((evento, sessao) => { if (evento === "SIGNED_IN" && sessao && modo !== "real") entrarReal(); });
}
if (LOCAL && sessionStorage.getItem(CHAVE_SESSAO) === "teste") document.getElementById("entrar-teste")?.click();
