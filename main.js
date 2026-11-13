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

// ---------- Hero: escolhe o negócio e vê como fica ----------
// Exemplos ilustrativos (sem preços nem avaliações inventadas).
const NEGOCIOS = {
  salao: {
    nome: { pt: "O teu salão", br: "Seu salão" }, tipo: "Salão", tom: "#F26A21", claro: "#FEF1E8",
    frase: { pt: "Marca o teu próximo corte", br: "Agende seu próximo corte" },
    servicos: ["Corte", "Coloração", "Madeixas", "Brushing"],
    pergunta: { pt: "Olá! Têm vaga para madeixas sábado?", br: "Oi! Tem horário pra luzes no sábado?" },
  },
  barbearia: {
    nome: { pt: "A tua barbearia", br: "Sua barbearia" }, tipo: "Barbearia", tom: "#2F5D8A", claro: "#E8EFF7",
    frase: { pt: "Corte e barba sem esperar", br: "Corte e barba sem esperar" },
    servicos: ["Corte", "Barba", "Corte + barba", "Sobrancelha"],
    pergunta: { pt: "Dá para cortar hoje ao fim do dia?", br: "Dá pra cortar hoje no fim do dia?" },
  },
  estetica: {
    nome: { pt: "O teu espaço", br: "Seu espaço" }, tipo: "Estética", tom: "#C2577A", claro: "#FBEAF0",
    frase: { pt: "Cuida de ti, marca online", br: "Se cuide, agende online" },
    servicos: ["Limpeza de pele", "Depilação", "Manicure", "Massagem"],
    pergunta: { pt: "Olá! Quanto custa a limpeza de pele?", br: "Oi! Quanto custa a limpeza de pele?" },
  },
  clinica: {
    nome: { pt: "A tua clínica", br: "Sua clínica" }, tipo: "Clínica", tom: "#1F8A70", claro: "#E3F4EE",
    frase: { pt: "Marca a tua consulta", br: "Agende sua consulta" },
    servicos: ["Consulta", "Avaliação", "Tratamentos", "Acompanhamento"],
    pergunta: { pt: "Boa noite, têm consulta esta semana?", br: "Boa noite, tem consulta essa semana?" },
  },
  fisio: {
    nome: { pt: "A tua fisioterapia", br: "Sua fisioterapia" }, tipo: "Fisioterapia", tom: "#5B6BC0", claro: "#ECEEFA",
    frase: { pt: "Volta a mexer-te sem dor", br: "Volte a se mexer sem dor" },
    servicos: ["Avaliação", "Fisioterapia", "Pilates clínico", "Massagem terapêutica"],
    pergunta: { pt: "Olá! Têm horário para avaliação?", br: "Oi! Tem horário pra avaliação?" },
  },
};
const RESPOSTA = { pt: "Olá! Marca aqui em 1 minuto:", br: "Oi! Agende aqui em 1 minuto:" };
const ESCREVER = '<span class="a-escrever"><i></i><i></i><i></i></span>';

const botoesNegocio = [...document.querySelectorAll("[data-negocio]")];
const telemovel = document.querySelector(".telemovel");
const site = document.getElementById("montra-site");
const pergunta = document.getElementById("montra-pergunta");
const resposta = document.getElementById("montra-resposta");
const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let negocioAtual = "salao";
let temporizadores = [];
let rodarNegocios = !semMovimento;

function reiniciarBolha(el, html) {
  el.innerHTML = html;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
}

function mostrarNegocio(chave, animar = true) {
  const n = NEGOCIOS[chave];
  const m = mercadoAtual();
  negocioAtual = chave;
  temporizadores.forEach(clearTimeout);
  temporizadores = [];

  botoesNegocio.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.negocio === chave)));
  telemovel.style.setProperty("--tom", n.tom);
  telemovel.style.setProperty("--tom-claro", n.claro);

  const pintar = () => {
    document.getElementById("montra-nome").textContent = n.nome[m];
    document.getElementById("montra-frase").textContent = n.frase[m];
    document.getElementById("montra-servicos").innerHTML = n.servicos.map((s) => `<li>${s}</li>`).join("");
    site.classList.remove("a-mudar");
  };
  if (animar && !semMovimento) {
    site.classList.add("a-mudar");
    temporizadores.push(setTimeout(pintar, 220));
  } else pintar();

  // A conversa: o cliente pergunta, o WhatsApp "escreve" e responde
  reiniciarBolha(pergunta, n.pergunta[m]);
  const respostaFinal = `${RESPOSTA[m]} <u>link</u>`;
  if (semMovimento) { resposta.innerHTML = respostaFinal; return; }
  reiniciarBolha(resposta, ESCREVER);
  temporizadores.push(setTimeout(() => reiniciarBolha(resposta, respostaFinal), 1100));
}

botoesNegocio.forEach((b, i) => {
  b.addEventListener("click", () => {
    rodarNegocios = false;
    mostrarNegocio(b.dataset.negocio);
    formulario.tipo.value = NEGOCIOS[b.dataset.negocio].tipo;
  });
  b.addEventListener("keydown", (e) => {
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!passo) return;
    e.preventDefault();
    rodarNegocios = false;
    const prox = botoesNegocio[(i + passo + botoesNegocio.length) % botoesNegocio.length];
    prox.focus();
    mostrarNegocio(prox.dataset.negocio);
    formulario.tipo.value = NEGOCIOS[prox.dataset.negocio].tipo;
  });
});
botoesMercado.forEach((b) => b.addEventListener("click", () => mostrarNegocio(negocioAtual, false)));

// Enquanto ninguém escolhe, vai mostrando os vários negócios
let heroVisivel = true;
new IntersectionObserver(([e]) => (heroVisivel = e.isIntersecting)).observe(document.querySelector(".hero"));
setInterval(() => {
  if (!rodarNegocios || !heroVisivel || document.hidden) return;
  const i = botoesNegocio.findIndex((b) => b.dataset.negocio === negocioAtual);
  mostrarNegocio(botoesNegocio[(i + 1) % botoesNegocio.length].dataset.negocio);
}, 4200);
mostrarNegocio("salao", false);
