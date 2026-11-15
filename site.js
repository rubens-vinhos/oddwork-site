// ---------- Configuração ----------
const VAGAS_FUNDADOR = { total: 10, restam: 10 };
// Endereço que recebe os pedidos (Supabase ou Apps Script). Vazio = ainda não ligado.
const CFG = window.ODDWORK || {};
const PEDIDOS_URL = CFG.supabaseUrl ? CFG.supabaseUrl + "/rest/v1/pedidos" : "";
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

// ---------- País (PT/BR) ----------
const botoesMercado = document.querySelectorAll(".mercado [data-mercado]");
// Frases com versão brasileira ("você") guardada em data-br; a portuguesa fica em data-pt.
const frasesBR = document.querySelectorAll("[data-br]");
frasesBR.forEach((el) => { el.dataset.pt = el.innerHTML; });
const eBR = () => document.documentElement.dataset.mercado === "br";
function aplicarMercado(m) {
  document.documentElement.dataset.mercado = m;
  document.documentElement.lang = m === "br" ? "pt-BR" : "pt-PT";
  frasesBR.forEach((el) => { el.innerHTML = m === "br" ? el.dataset.br : el.dataset.pt; });
  botoesMercado.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mercado === m)));
  const pais = document.querySelector('input[name="pais"]');
  if (pais) pais.value = m === "br" ? "Brasil" : "Portugal";
}
botoesMercado.forEach((b) =>
  b.addEventListener("click", () => {
    aplicarMercado(b.dataset.mercado);
    try { localStorage.setItem("oddwork-mercado", b.dataset.mercado); } catch { /* sem armazenamento */ }
  })
);
aplicarMercado(document.documentElement.dataset.mercado === "br" ? "br" : "pt");

// ---------- Vagas de fundador ----------
const { total, restam } = VAGAS_FUNDADOR;
document.querySelectorAll("[data-vagas-frase]").forEach((el) => {
  el.textContent = restam > 0
    ? `Restam ${restam} de ${total} vagas. O preço de fundador fica enquanto a assinatura estiver ativa.`
    : "As vagas de fundador estão preenchidas.";
});
document.querySelectorAll("[data-vagas-barra]").forEach((el) => {
  el.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < total - restam ? "ocupada" : ""}"></i>`).join("");
  el.parentElement.setAttribute("aria-label", `${restam} de ${total} vagas livres`);
  el.parentElement.removeAttribute("aria-hidden");
});

// ---------- Hero: "Hoje, sem ti" ----------
const itens = [...document.querySelectorAll("#dia-lista li")];
const horasEl = document.getElementById("dia-horas");
const MINUTOS = [55, 20, 45, 15, 25]; // minutos poupados por tarefa (exemplo)
const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

function mostrarTudo() {
  itens.forEach((li) => { li.classList.remove("espera", "agora"); li.classList.add("feito"); });
  horasEl.textContent = fmt(MINUTOS.reduce((a, b) => a + b, 0));
}

if (reduzido || !itens.length) {
  mostrarTudo();
} else {
  let passo = 0, acumulado = 0, timer = null, visivel = true;
  const reiniciar = () => {
    passo = 0; acumulado = 0; horasEl.textContent = fmt(0);
    itens.forEach((li) => { li.className = "espera"; });
  };
  const contar = (de, ate) => {
    const t0 = performance.now();
    const f = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      horasEl.textContent = fmt(Math.round(de + (ate - de) * k));
      if (k < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };
  const avancar = () => {
    if (!visivel) return;
    if (passo >= itens.length) { timer = setTimeout(() => { reiniciar(); timer = setTimeout(avancar, 600); }, 3500); return; }
    const li = itens[passo];
    li.className = "agora";
    timer = setTimeout(() => {
      li.className = "feito";
      contar(acumulado, acumulado + MINUTOS[passo]);
      acumulado += MINUTOS[passo];
      passo++;
      timer = setTimeout(avancar, 650);
    }, 700);
  };
  reiniciar();
  new IntersectionObserver(([e]) => {
    const antes = visivel;
    visivel = e.isIntersecting;
    if (visivel && !antes) { clearTimeout(timer); avancar(); }
  }).observe(document.getElementById("dia"));
  setTimeout(avancar, 500);
}

// ---------- Barra fixa no telemóvel ----------
const barra = document.getElementById("barra");
if (barra) {
  const alvos = document.querySelectorAll(".noite, #diagnostico, .rodape");
  const vistos = new Set();
  const obs = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? vistos.add(e.target) : vistos.delete(e.target)));
    const mostrar = vistos.size === 0;
    barra.classList.toggle("visivel", mostrar);
    barra.setAttribute("aria-hidden", String(!mostrar));
    barra.querySelector("a").tabIndex = mostrar ? 0 : -1;
  });
  alvos.forEach((a) => obs.observe(a));
}

// ---------- Formulário de diagnóstico ----------
const form = document.getElementById("formulario");
const erro = document.getElementById("formulario-erro");
const botao = document.getElementById("formulario-botao");
const sucesso = document.getElementById("formulario-sucesso");

function mostrarErro(msg) { erro.textContent = msg; erro.hidden = false; }

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  erro.hidden = true;
  form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));

  const invalidos = [...form.querySelectorAll("[required]")].filter((el) =>
    el.type === "checkbox" ? !el.checked : !el.checkValidity() || !el.value.trim()
  );
  if (invalidos.length) {
    invalidos.forEach((el) => el.setAttribute("aria-invalid", "true"));
    invalidos[0].focus();
    mostrarErro(invalidos[0].type === "checkbox"
      ? (eBR() ? "Falta aceitar o uso dos dados para entrarmos em contato." : "Falta aceitar o uso dos dados para te contactarmos.")
      : (eBR() ? "Preencha os campos marcados para pedir o diagnóstico." : "Preenche os campos assinalados para pedirmos o diagnóstico."));
    return;
  }
  if (form.website.value) return; // isco para robôs

  const dados = Object.fromEntries(new FormData(form));
  delete dados.website;
  dados.data = new Date().toISOString();
  // Com autorização de estatísticas, o pedido leva o identificador do visitante (para o percurso no painel).
  if (window.oddworkVisitante && window.oddworkConsentimento?.estatisticas) {
    dados.vid = window.oddworkVisitante;
    window.oddworkEvento?.("pedido", {});
  }

  botao.disabled = true;
  botao.textContent = eBR() ? "Enviando…" : "A enviar…";
  try {
    if (PEDIDOS_URL) {
      const campos = ["nome", "negocio", "tipo", "clientes", "dor", "whatsapp", "email", "origem", "pais", "vid"];
      const corpo = Object.fromEntries(campos.map((c) => [c, (dados[c] || "").toString().trim() || null]));
      const r = await fetch(PEDIDOS_URL, {
        method: "POST",
        headers: { apikey: CFG.supabaseChave, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) throw new Error(String(r.status));
    } else if (LOCAL) {
      // Só no computador de teste: guarda o pedido para aparecer no painel local.
      const lista = JSON.parse(localStorage.getItem("oddwork-pedidos-teste") || "[]");
      lista.push({ ...dados, id: "t" + Date.now(), estado: "novo" });
      localStorage.setItem("oddwork-pedidos-teste", JSON.stringify(lista));
    } else {
      throw new Error("sem-destino");
    }
    form.hidden = true;
    sucesso.hidden = false;
    sucesso.focus();
  } catch {
    mostrarErro(eBR()
      ? "Não conseguimos enviar agora. Escreva para geral@theoddwork.com e respondemos no mesmo dia."
      : "Não conseguimos enviar agora. Escreve-nos para geral@theoddwork.com e respondemos no mesmo dia.");
    botao.disabled = false;
    botao.textContent = "Pedir diagnóstico";
  }
});
