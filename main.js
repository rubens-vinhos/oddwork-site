// ---------- Configuração (o único sítio a editar à mão) ----------
// Vagas de fundador: 10 no total, partilhadas entre Portugal e Brasil.
// Atualizar "restam" sempre que entra um cliente fundador. Nunca mostrar números inventados.
const VAGAS_FUNDADOR = { total: 10, restam: 10 };

// Endereço que recebe as candidaturas (Google Apps Script ligado a uma folha no geral@).
// Ver scripts/candidaturas.gs.
const CANDIDATURAS_URL = "";

const raiz = document.documentElement;
const mercadoAtual = () => (raiz.dataset.mercado === "br" ? "br" : "pt");
document.getElementById("ano").textContent = new Date().getFullYear();

// ---------- Vagas de fundador ----------
const restam = Math.max(0, Math.min(VAGAS_FUNDADOR.total, VAGAS_FUNDADOR.restam));
const frase = restam === 0
  ? `As ${VAGAS_FUNDADOR.total} vagas de fundador estão preenchidas.`
  : `${restam === 1 ? "Resta" : "Restam"} ${restam} de ${VAGAS_FUNDADOR.total} vagas a preço de fundador.`;
document.querySelectorAll("[data-vagas-frase]").forEach((el) => (el.textContent = frase));

// ---------- País (PT/BR) ----------
const formulario = document.getElementById("formulario");
const botoesMercado = document.querySelectorAll("[data-mercado]");
function aplicarMercado(m) {
  raiz.dataset.mercado = m;
  raiz.lang = m === "br" ? "pt-BR" : "pt-PT";
  botoesMercado.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mercado === m)));
  formulario.pais.value = m === "br" ? "Brasil" : "Portugal";
}
botoesMercado.forEach((b) =>
  b.addEventListener("click", () => {
    aplicarMercado(b.dataset.mercado);
    try { localStorage.setItem("oddwork-mercado", b.dataset.mercado); } catch { /* sem armazenamento */ }
  })
);
aplicarMercado(mercadoAtual());

// ---------- Barra em baixo no telemóvel: some no topo e na candidatura ----------
const barra = document.getElementById("barra");
const zonas = new Map();
const observar = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => zonas.set(e.target, e.isIntersecting));
  barra.classList.toggle("visivel", ![...zonas.values()].some(Boolean));
});
document.querySelectorAll(".hero, #candidatura, .rodape").forEach((el) => observar.observe(el));

// ---------- Plano: a ligação do Pro põe a candidatura na lista de espera ----------
const avisoPlano = document.getElementById("formulario-plano");
document.querySelectorAll('a[href="#candidatura"]').forEach((a) =>
  a.addEventListener("click", () => {
    const pro = a.dataset.plano === "pro";
    formulario.plano.value = pro ? "Pro (lista de espera)" : "Essencial";
    avisoPlano.hidden = !pro;
  })
);

// ---------- Candidatura ----------
const erro = document.getElementById("formulario-erro");
const botao = document.getElementById("formulario-botao");
const sucesso = document.getElementById("formulario-sucesso");

const TEXTOS = {
  pt: {
    falta: "Falta preencher: ",
    email: "O email não parece válido.",
    consentimento: "Marca a caixa da autorização para podermos responder.",
    falhou: "Não conseguimos enviar agora. Tenta de novo ou escreve para geral@theoddwork.com.",
    aEnviar: "A enviar…",
  },
  br: {
    falta: "Falta preencher: ",
    email: "O email não parece válido.",
    consentimento: "Marque a caixa da autorização para podermos responder.",
    falhou: "Não conseguimos enviar agora. Tente de novo ou escreva para geral@theoddwork.com.",
    aEnviar: "Enviando…",
  },
};

function nomeDoCampo(campo) {
  const rotulo = campo.closest("label").querySelector(":scope > span");
  const visivel = [...rotulo.querySelectorAll("[data-m]")].find((s) => s.offsetParent !== null);
  return (visivel || rotulo).textContent.trim();
}
function mostrarErro(texto, foco) {
  erro.textContent = texto;
  erro.hidden = false;
  foco?.focus();
}

formulario.addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = TEXTOS[mercadoAtual()];
  erro.hidden = true;

  const emFalta = [...formulario.querySelectorAll("input[required]:not([type=checkbox]), select[required]")]
    .filter((c) => {
      const vazio = !c.value.trim();
      c.setAttribute("aria-invalid", String(vazio));
      return vazio;
    });
  if (emFalta.length) return mostrarErro(t.falta + emFalta.map(nomeDoCampo).join(", ") + ".", emFalta[0]);
  if (!formulario.email.checkValidity()) {
    formulario.email.setAttribute("aria-invalid", "true");
    return mostrarErro(t.email, formulario.email);
  }
  if (!formulario.consentimento.checked) return mostrarErro(t.consentimento, formulario.consentimento);

  const dados = new URLSearchParams(new FormData(formulario));
  dados.set("mercado", mercadoAtual());
  dados.set("pagina", location.href);

  const textoBotao = botao.textContent;
  botao.disabled = true;
  botao.textContent = t.aEnviar;
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
    botao.disabled = false;
    botao.textContent = textoBotao;
  }
});
