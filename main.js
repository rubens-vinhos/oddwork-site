// ---------- Configuração (confirmar antes de publicar) ----------
const EMAIL = "geral@theoddwork.com";
// Payment Links do Stripe (assinatura mensal com 30 dias grátis). Vazio = o botão leva ao contacto.
const PAGAMENTO = { pt: "", br: "" };
const MERCADOS = {
  pt: { preco: "69 €", nota: "IVA incluído", rotulo: "Portugal" },
  br: { preco: "R$ 450", nota: "Valor em reais, sem conversão", rotulo: "Brasil" },
};

// Vagas por mês: 8 no total. Atualizar "ocupadas" à mão sempre que entra um cliente.
// Nunca mostrar números inventados.
const VAGAS = { total: 8, ocupadas: 0 };

document.getElementById("ano").textContent = new Date().getFullYear();

// ---------- Vagas do mês ----------
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];
const hoje = new Date();
const mesAtual = MESES[hoje.getMonth()];
const mesSeguinte = MESES[(hoje.getMonth() + 1) % 12];
const restam = Math.max(0, VAGAS.total - VAGAS.ocupadas);
const cheio = restam === 0;

const frase = cheio
  ? `${mesAtual[0].toUpperCase()}${mesAtual.slice(1)} está completo. A lista de ${mesSeguinte} está aberta.`
  : `${restam === 1 ? "Resta 1 vaga" : `Restam ${restam} vagas`} para ${mesAtual}.`;

document.querySelectorAll("[data-vagas-frase]").forEach((el) => (el.textContent = frase));
document.querySelectorAll("[data-vagas-curta]").forEach((el) => {
  el.textContent = cheio ? "Lista de espera" : restam === 1 ? "1 vaga" : `${restam} vagas`;
});
document.querySelectorAll("[data-vagas-mes]").forEach((el) => (el.textContent = cheio ? mesSeguinte : mesAtual));
document.querySelectorAll("[data-vagas-botao]").forEach((el) => {
  if (cheio) el.textContent = el.closest(".barra-fixa") ? "Entrar na lista" : `Entrar na lista de ${mesSeguinte}`;
});

const medidor = document.getElementById("vagas-medidor");
for (let i = 0; i < VAGAS.total; i++) {
  const seg = document.createElement("span");
  if (i < VAGAS.ocupadas) seg.className = "ocupada";
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
document.querySelectorAll(".hero, #planos, #contacto, .rodape").forEach((el) => observarBarra.observe(el));

// ---------- Linha por baixo do topo quando se faz scroll ----------
const topo = document.querySelector(".topo");
const marcarTopo = () => topo.classList.toggle("com-linha", window.scrollY > 8);
window.addEventListener("scroll", marcarTopo, { passive: true });
marcarTopo();

// ---------- Mercado e preço ----------
function lerMercadoGuardado() {
  try { return localStorage.getItem("oddwork-mercado"); } catch { return null; }
}
function guardarMercado(m) {
  try { localStorage.setItem("oddwork-mercado", m); } catch { /* sem armazenamento */ }
}
function mercadoInicial() {
  const guardado = lerMercadoGuardado();
  if (guardado && MERCADOS[guardado]) return guardado;
  const linguas = navigator.languages || [navigator.language || ""];
  return linguas.some((l) => /^pt-br/i.test(l)) ? "br" : "pt";
}

let mercado = mercadoInicial();
const botoesMercado = document.querySelectorAll("[data-mercado]");

function aplicarMercado(m) {
  mercado = m;
  document.getElementById("preco").textContent = MERCADOS[m].preco;
  document.getElementById("preco-nota").textContent = MERCADOS[m].nota;
  botoesMercado.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mercado === m)));
  const ligacao = PAGAMENTO[m];
  document.querySelectorAll("[data-vagas-botao]").forEach((el) => {
    el.href = ligacao && !cheio ? ligacao : el.closest(".barra-fixa") ? "#planos" : "#contacto";
  });
}
botoesMercado.forEach((b) =>
  b.addEventListener("click", () => {
    aplicarMercado(b.dataset.mercado);
    guardarMercado(b.dataset.mercado);
  })
);
aplicarMercado(mercado);

// ---------- Formulário de contacto (abre o email) ----------
const formulario = document.getElementById("formulario");
const erro = document.getElementById("formulario-erro");

formulario.addEventListener("submit", (e) => {
  e.preventDefault();
  const dados = new FormData(formulario);
  const nome = String(dados.get("nome") || "").trim();
  const negocio = String(dados.get("negocio") || "").trim();
  const mensagem = String(dados.get("mensagem") || "").trim();

  const emFalta = [];
  formulario.nome.setAttribute("aria-invalid", String(!nome));
  formulario.negocio.setAttribute("aria-invalid", String(!negocio));
  if (!nome) emFalta.push("o teu nome");
  if (!negocio) emFalta.push("o nome do negócio");

  if (emFalta.length) {
    erro.textContent = `Falta ${emFalta.join(" e ")}.`;
    erro.hidden = false;
    (nome ? formulario.negocio : formulario.nome).focus();
    return;
  }
  erro.hidden = true;

  const texto = [
    `Olá! Sou ${nome}, do negócio ${negocio}.`,
    `Mercado: ${MERCADOS[mercado].rotulo}.`,
    mensagem && `\n${mensagem}`,
  ].filter(Boolean).join("\n");
  const assunto = `Oddwork: ${negocio}`;
  location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
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
