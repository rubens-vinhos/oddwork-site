// ---------- Configuração (o único sítio a editar à mão) ----------
// Vagas de fundador: 10 no total, partilhadas entre Portugal e Brasil.
// Atualizar "restam" sempre que entra um cliente fundador. Nunca mostrar números inventados.
const VAGAS_FUNDADOR = { total: 10, restam: 10 };

// Endereço que recebe as candidaturas (Google Apps Script ligado a uma folha no geral@).
// Ver scripts/candidaturas.gs.
const CANDIDATURAS_URL = "";

const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mercadoAtual = () => (document.documentElement.dataset.mercado === "br" ? "br" : "pt");

document.getElementById("ano").textContent = new Date().getFullYear();

// ---------- Vagas de fundador ----------
const restam = Math.max(0, Math.min(VAGAS_FUNDADOR.total, VAGAS_FUNDADOR.restam));
const frase = restam === 0
  ? `As ${VAGAS_FUNDADOR.total} vagas de fundador estão preenchidas.`
  : `${restam === 1 ? "Resta" : "Restam"} ${restam} de ${VAGAS_FUNDADOR.total} vagas de fundador.`;
document.querySelectorAll("[data-vagas-frase]").forEach((el) => (el.textContent = frase));

const medidor = document.getElementById("vagas-medidor");
for (let i = 0; i < VAGAS_FUNDADOR.total; i++) {
  const seg = document.createElement("span");
  if (i >= restam) seg.className = "ocupada";
  medidor.appendChild(seg);
}

// ---------- Navegação por ecrãs: o início escolhe, cada secção abre por cima ----------
const raiz = document.documentElement;
const vistas = [...document.querySelectorAll(".vista")];
const corpoVistas = document.getElementById("vistas-corpo");
const ligacaoSeguinte = document.getElementById("vista-seguinte");
const ctaFim = document.getElementById("vista-cta");
const navVistas = [...document.querySelectorAll(".vistas__nav a")];
const NOMES = {
  servicos: "O que fazemos", precos: "Preços", "como-funciona": "Como funciona",
  "quem-somos": "Quem somos", perguntas: "Perguntas", candidatura: "Candidatura",
};
// Endereços antigos e atalhos continuam a funcionar
const ALIAS = { pecas: "servicos", planos: "precos", fundadores: "quem-somos", contacto: "candidatura" };
const SEPARADORES_FUNCIONA = ["mes-gratis", "cancelar", "trabalho", "relatorio", "extras"];
let ultimaPlaca = null;

function rota() {
  let id = decodeURIComponent(location.hash.slice(1));
  let separador = null;
  if (SEPARADORES_FUNCIONA.includes(id)) { separador = id; id = "como-funciona"; }
  id = ALIAS[id] || id;
  const vista = vistas.find((v) => v.id === id);

  if (!vista) {
    raiz.classList.remove("vista-aberta");
    vistas.forEach((v) => v.classList.remove("ativa"));
    if (ultimaPlaca) { ultimaPlaca.focus({ preventScroll: true }); ultimaPlaca = null; }
    return;
  }
  const jaAberta = raiz.classList.contains("vista-aberta");
  vistas.forEach((v) => v.classList.toggle("ativa", v === vista));
  raiz.classList.add("vista-aberta");
  navVistas.forEach((a) => a.toggleAttribute("aria-current", a.getAttribute("href") === `#${id}`));
  navVistas.find((a) => a.hasAttribute("aria-current"))?.scrollIntoView({ block: "nearest", inline: "center" });

  // Fim do ecrã: o próximo passo
  const i = vistas.indexOf(vista);
  const seguinte = vistas[i + 1];
  ligacaoSeguinte.hidden = !seguinte;
  if (seguinte) {
    ligacaoSeguinte.href = `#${seguinte.id}`;
    ligacaoSeguinte.querySelector("strong").textContent = NOMES[seguinte.id];
  }
  ctaFim.hidden = id === "candidatura";

  if (separador) abrirSeparador(document.querySelector(`[aria-controls="${separador}"]`));
  corpoVistas.scrollTop = 0;
  corpoVistas.classList.remove("entrar");
  void corpoVistas.offsetWidth; // reinicia a animação
  if (!semMovimento) corpoVistas.classList.add(jaAberta ? "trocar" : "entrar");
  vista.querySelector("h2")?.focus({ preventScroll: true });
}

function irInicio(e) {
  e?.preventDefault();
  history.pushState(null, "", location.pathname + location.search);
  rota();
}
document.querySelectorAll("[data-ir-inicio]").forEach((a) => a.addEventListener("click", irInicio));
document.querySelectorAll(".painel a").forEach((a) => a.addEventListener("click", () => (ultimaPlaca = a)));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && raiz.classList.contains("vista-aberta")) irInicio(e);
});
window.addEventListener("hashchange", rota);

// ---------- Situações do dia a dia, uma de cada vez ----------
document.querySelectorAll(".situacoes ul").forEach((ul) => {
  const itens = [...ul.children];
  let n = 0;
  itens.forEach((li, i) => li.classList.toggle("ativa", i === 0));
  if (semMovimento) return;
  setInterval(() => {
    if (document.hidden || raiz.classList.contains("vista-aberta")) return;
    itens[n].classList.remove("ativa");
    n = (n + 1) % itens.length;
    itens[n].classList.add("ativa");
  }, 3800);
});

// ---------- Mercado (PT/BR): textos, preços e formulário ----------
// O mercado inicial é escolhido em mercado.js, antes de a página aparecer.
const formulario = document.getElementById("formulario");
const botoesMercado = document.querySelectorAll("[data-mercado]");

function aplicarMercado(m) {
  document.documentElement.dataset.mercado = m;
  document.documentElement.lang = m === "br" ? "pt-BR" : "pt-PT";
  botoesMercado.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mercado === m)));
  formulario.querySelector(`input[name="pais"][value="${m === "br" ? "Brasil" : "Portugal"}"]`).checked = true;
}
function guardarMercado(m) {
  try { localStorage.setItem("oddwork-mercado", m); } catch { /* sem armazenamento */ }
}
botoesMercado.forEach((b) =>
  b.addEventListener("click", () => {
    aplicarMercado(b.dataset.mercado);
    guardarMercado(b.dataset.mercado);
  })
);
// Escolher o país no formulário também muda o mercado da página
formulario.querySelectorAll('input[name="pais"]').forEach((r) =>
  r.addEventListener("change", () => {
    const m = r.value === "Brasil" ? "br" : "pt";
    aplicarMercado(m);
    guardarMercado(m);
  })
);
aplicarMercado(mercadoAtual());

// ---------- Serviços: separadores ligados à vista explodida ----------
const partes = document.querySelectorAll(".explodida .parte");
const tabsPecas = [...document.querySelectorAll(".pecas__tabs [role=tab]")];
const detalhes = document.querySelectorAll("[data-peca-detalhe]");
let pecaAtiva = "site";
let rodarPecas = !semMovimento;

function mostrarPeca(peca, foco = false) {
  pecaAtiva = peca;
  partes.forEach((p) => p.classList.toggle("ativa", p.dataset.peca === peca));
  tabsPecas.forEach((t) => {
    const ativo = t.dataset.peca === peca;
    t.setAttribute("aria-selected", String(ativo));
    t.tabIndex = ativo ? 0 : -1;
    if (ativo && foco) t.focus();
  });
  detalhes.forEach((d) => (d.hidden = d.dataset.pecaDetalhe !== peca));
}
function pararRotacao() { rodarPecas = false; }

tabsPecas.forEach((t, i) => {
  t.addEventListener("click", () => { pararRotacao(); mostrarPeca(t.dataset.peca); });
  t.addEventListener("keydown", (e) => {
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!passo) return;
    e.preventDefault();
    pararRotacao();
    mostrarPeca(tabsPecas[(i + passo + tabsPecas.length) % tabsPecas.length].dataset.peca, true);
  });
});
partes.forEach((p) => {
  p.addEventListener("click", () => { pararRotacao(); mostrarPeca(p.dataset.peca); });
  p.addEventListener("mouseenter", () => { pararRotacao(); mostrarPeca(p.dataset.peca); });
});
mostrarPeca("site");

// Enquanto ninguém mexe, as peças vão acendendo sozinhas (só com a secção à vista)
const vistaServicos = document.getElementById("servicos");
setInterval(() => {
  if (!rodarPecas || !vistaServicos.classList.contains("ativa") || document.hidden) return;
  const i = tabsPecas.findIndex((t) => t.dataset.peca === pecaAtiva);
  mostrarPeca(tabsPecas[(i + 1) % tabsPecas.length].dataset.peca);
}, 3200);

// ---------- Como funciona: separadores ----------
const separadores = [...document.querySelectorAll(".separadores [role=tab]")];

function abrirSeparador(sep, foco = false) {
  separadores.forEach((s) => {
    const ativo = s === sep;
    s.setAttribute("aria-selected", String(ativo));
    s.tabIndex = ativo ? 0 : -1;
    document.getElementById(s.getAttribute("aria-controls")).hidden = !ativo;
  });
  if (foco) sep.focus();
}
separadores.forEach((s, i) => {
  s.addEventListener("click", () => abrirSeparador(s));
  s.addEventListener("keydown", (e) => {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!passo) return;
    e.preventDefault();
    abrirSeparador(separadores[(i + passo + separadores.length) % separadores.length], true);
  });
});

// ---------- Botões de plano preenchem o formulário ----------
document.querySelectorAll("[data-plano]").forEach((el) =>
  el.addEventListener("click", () => {
    const valor = el.dataset.plano === "pro" ? "Pro (lista de espera)" : "Essencial";
    formulario.querySelector(`input[name="plano"][value="${valor}"]`).checked = true;
  })
);

// ---------- Formulário de candidatura em 3 passos ----------
const erro = document.getElementById("formulario-erro");
const botaoEnviar = document.getElementById("formulario-botao");
const botaoVoltar = document.getElementById("formulario-voltar");
const sucesso = document.getElementById("formulario-sucesso");
const passos = [...formulario.querySelectorAll(".passo")];
const marcas = [...formulario.querySelectorAll("[data-passo-marca]")];
let passoAtual = 0;

const TEXTOS = {
  pt: {
    falta: "Falta preencher: ",
    email: "O email não parece válido.",
    consentimento: "Para enviarmos a candidatura precisamos da tua autorização (primeira caixa).",
    falhou: "Não conseguimos enviar agora. Tenta de novo ou escreve para geral@theoddwork.com.",
    aEnviar: "A enviar…",
    continuar: "Continuar",
    enviar: "Enviar candidatura",
  },
  br: {
    falta: "Falta preencher: ",
    email: "O email não parece válido.",
    consentimento: "Para enviar a candidatura precisamos da sua autorização (primeira caixa).",
    falhou: "Não conseguimos enviar agora. Tente de novo ou escreva para geral@theoddwork.com.",
    aEnviar: "Enviando…",
    continuar: "Continuar",
    enviar: "Enviar candidatura",
  },
};

function nomeDoCampo(campo) {
  const legenda = campo.closest("fieldset.escolha")?.querySelector("legend");
  const rotulo = legenda || campo.closest("label")?.querySelector(":scope > span");
  const visivel = rotulo && [...rotulo.querySelectorAll("[data-m]")].find((s) => s.offsetParent !== null);
  return (visivel || rotulo)?.textContent.replace("(opcional)", "").replace(/\?$/, "").trim() || campo.name;
}

function mostrarErro(texto, foco) {
  erro.textContent = texto;
  erro.hidden = false;
  foco?.focus();
}

function irParaPasso(n, foco = true) {
  passoAtual = n;
  passos.forEach((p, i) => (p.hidden = i !== n));
  marcas.forEach((m, i) => {
    m.classList.toggle("ativo", i === n);
    m.classList.toggle("feito", i < n);
  });
  botaoVoltar.hidden = n === 0;
  const t = TEXTOS[mercadoAtual()];
  botaoEnviar.textContent = n === passos.length - 1 ? t.enviar : t.continuar;
  erro.hidden = true;
  if (foco) passos[n].querySelector("input")?.focus({ preventScroll: true });
}

// Valida só os campos do passo à vista
function validarPasso(n) {
  const t = TEXTOS[mercadoAtual()];
  const vistos = new Set();
  const emFalta = [];
  passos[n].querySelectorAll("[required]").forEach((c) => {
    if (c.name === "consentimento" || vistos.has(c.name)) return;
    vistos.add(c.name);
    const vazio = c.type === "radio"
      ? !formulario.querySelector(`input[name="${c.name}"]:checked`)
      : !String(c.value).trim();
    if (c.type !== "radio") c.setAttribute("aria-invalid", String(vazio));
    if (vazio) emFalta.push(c);
  });
  if (emFalta.length) {
    mostrarErro(t.falta + emFalta.map(nomeDoCampo).join(", ") + ".", emFalta[0]);
    return false;
  }
  const email = passos[n].querySelector('input[type="email"]');
  if (email && !email.checkValidity()) {
    email.setAttribute("aria-invalid", "true");
    mostrarErro(t.email, email);
    return false;
  }
  const consentimento = passos[n].querySelector('input[name="consentimento"]');
  if (consentimento && !consentimento.checked) {
    mostrarErro(t.consentimento, consentimento);
    return false;
  }
  return true;
}

botaoVoltar.addEventListener("click", () => irParaPasso(passoAtual - 1));

formulario.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validarPasso(passoAtual)) return;
  if (passoAtual < passos.length - 1) return irParaPasso(passoAtual + 1);

  const t = TEXTOS[mercadoAtual()];
  const dados = new URLSearchParams(new FormData(formulario));
  dados.set("novidades", formulario.novidades.checked ? "sim" : "não");
  dados.set("mercado", mercadoAtual());
  dados.set("pagina", location.href);

  botaoEnviar.disabled = true;
  botaoEnviar.textContent = t.aEnviar;
  try {
    if (!CANDIDATURAS_URL) throw new Error("sem destino configurado");
    // Pedido simples (sem cabeçalhos próprios) para o Apps Script aceitar sem pré-verificação CORS
    const resposta = await fetch(CANDIDATURAS_URL, { method: "POST", body: dados });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok || json.ok !== true) throw new Error(json.erro || `HTTP ${resposta.status}`);
    formulario.hidden = true;
    sucesso.hidden = false;
    sucesso.focus();
  } catch (falha) {
    console.error("Candidatura não enviada:", falha);
    mostrarErro(t.falhou);
  } finally {
    botaoEnviar.disabled = false;
    botaoEnviar.textContent = t.enviar;
  }
});
irParaPasso(0, false);
rota();
