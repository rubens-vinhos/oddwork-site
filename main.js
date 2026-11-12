// ---------- Configuração (o único sítio a editar à mão) ----------
// Vagas de fundador: 10 no total, partilhadas entre Portugal e Brasil.
// Atualizar "restam" sempre que entra um cliente fundador. Nunca mostrar números inventados.
const VAGAS_FUNDADOR = { total: 10, restam: 10 };

// Endereço que recebe as candidaturas (Google Apps Script ligado a uma folha no geral@).
// Ver scripts/candidaturas.gs.
const CANDIDATURAS_URL = "";

document.getElementById("ano").textContent = new Date().getFullYear();

// ---------- Vagas de fundador ----------
const restam = Math.max(0, Math.min(VAGAS_FUNDADOR.total, VAGAS_FUNDADOR.restam));
const esgotado = restam === 0;
const frase = esgotado
  ? `As ${VAGAS_FUNDADOR.total} vagas de fundador estão preenchidas.`
  : `${restam === 1 ? "Resta" : "Restam"} ${restam} de ${VAGAS_FUNDADOR.total} vagas de fundador.`;

document.querySelectorAll("[data-vagas-frase]").forEach((el) => (el.textContent = frase));
document.querySelectorAll("[data-vagas-curta]").forEach((el) => {
  el.textContent = esgotado ? "Sem" : `${restam} de ${VAGAS_FUNDADOR.total}`;
});

const medidor = document.getElementById("vagas-medidor");
for (let i = 0; i < VAGAS_FUNDADOR.total; i++) {
  const seg = document.createElement("span");
  if (i >= restam) seg.className = "ocupada";
  medidor.appendChild(seg);
}

// ---------- Barra fixa no telemóvel ----------
const barra = document.getElementById("barra-fixa");
const zonasSemBarra = new Map();
const observarBarra = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => zonasSemBarra.set(e.target, e.isIntersecting));
  const esconder = [...zonasSemBarra.values()].some(Boolean);
  barra.classList.toggle("visivel", !esconder);
});
document.querySelectorAll(".hero, #planos, #candidatura, .rodape").forEach((el) => observarBarra.observe(el));

// ---------- Linha por baixo do topo quando se faz scroll ----------
const topo = document.querySelector(".topo");
const marcarTopo = () => topo.classList.toggle("com-linha", window.scrollY > 8);
window.addEventListener("scroll", marcarTopo, { passive: true });
marcarTopo();

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
aplicarMercado(document.documentElement.dataset.mercado === "br" ? "br" : "pt");

// ---------- Botões de plano preenchem o formulário ----------
document.querySelectorAll("[data-plano]").forEach((el) =>
  el.addEventListener("click", () => {
    const valor = el.dataset.plano === "pro" ? "Pro (lista de espera)" : "Essencial";
    formulario.querySelector(`input[name="plano"][value="${valor}"]`).checked = true;
  })
);

// ---------- Formulário de candidatura ----------
const erro = document.getElementById("formulario-erro");
const botaoEnviar = document.getElementById("formulario-botao");
const sucesso = document.getElementById("formulario-sucesso");

const TEXTOS = {
  pt: {
    falta: "Falta preencher: ",
    email: "O email não parece válido.",
    consentimento: "Para enviarmos a candidatura precisamos da tua autorização (primeira caixa).",
    falhou: "Não conseguimos enviar agora. Tenta de novo ou escreve para geral@theoddwork.com.",
    aEnviar: "A enviar…",
  },
  br: {
    falta: "Falta preencher: ",
    email: "O email não parece válido.",
    consentimento: "Para enviar a candidatura precisamos da sua autorização (primeira caixa).",
    falhou: "Não conseguimos enviar agora. Tente de novo ou escreva para geral@theoddwork.com.",
    aEnviar: "Enviando…",
  },
};

function nomeDoCampo(campo) {
  const legenda = campo.closest("fieldset")?.querySelector("legend");
  if (legenda) return legenda.textContent.trim();
  const rotulo = campo.closest("label")?.querySelector(":scope > span");
  const visivel = rotulo && [...rotulo.querySelectorAll("[data-m]")].find((s) => s.offsetParent !== null);
  return (visivel || rotulo)?.textContent.replace("(opcional)", "").replace(/\?$/, "").trim() || campo.name;
}

function mostrarErro(texto, foco) {
  erro.textContent = texto;
  erro.hidden = false;
  foco?.focus();
}

formulario.addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = TEXTOS[document.documentElement.dataset.mercado === "br" ? "br" : "pt"];

  const obrigatorios = [...formulario.querySelectorAll("[required]")].filter((c) => c.name !== "consentimento");
  const vistos = new Set();
  const emFalta = [];
  obrigatorios.forEach((c) => {
    if (vistos.has(c.name)) return;
    vistos.add(c.name);
    const vazio = c.type === "radio"
      ? !formulario.querySelector(`input[name="${c.name}"]:checked`)
      : !String(c.value).trim();
    if (c.type !== "radio") c.setAttribute("aria-invalid", String(vazio));
    if (vazio) emFalta.push(c);
  });
  if (emFalta.length) {
    return mostrarErro(t.falta + emFalta.map(nomeDoCampo).join(", ") + ".", emFalta[0]);
  }
  const email = formulario.email;
  if (!email.checkValidity()) {
    email.setAttribute("aria-invalid", "true");
    return mostrarErro(t.email, email);
  }
  if (!formulario.consentimento.checked) {
    return mostrarErro(t.consentimento, formulario.consentimento);
  }
  erro.hidden = true;

  const dados = new URLSearchParams(new FormData(formulario));
  dados.set("novidades", formulario.novidades.checked ? "sim" : "não");
  dados.set("mercado", document.documentElement.dataset.mercado);
  dados.set("pagina", location.href);

  const textoBotao = botaoEnviar.innerHTML;
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
    botaoEnviar.innerHTML = textoBotao;
  }
});

// ---------- Vista explodida: lista e peças acendem em conjunto ----------
const partes = document.querySelectorAll(".explodida .parte");
const itens = document.querySelectorAll(".lista-pecas li");

function acender(peca) {
  partes.forEach((p) => p.classList.toggle("ativa", p.dataset.peca === peca));
  itens.forEach((i) => i.classList.toggle("ativa", i.dataset.peca === peca));
}
itens.forEach((i) => {
  i.addEventListener("mouseenter", () => acender(i.dataset.peca));
  i.addEventListener("focus", () => acender(i.dataset.peca));
  i.addEventListener("mouseleave", () => acender(null));
  i.addEventListener("blur", () => acender(null));
});
partes.forEach((p) => {
  p.addEventListener("mouseenter", () => acender(p.dataset.peca));
  p.addEventListener("mouseleave", () => acender(null));
});
