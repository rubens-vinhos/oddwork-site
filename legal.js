// Páginas de texto (privacidade, termos): seletor PT/BR igual ao da página inicial.
const botoesMercado = document.querySelectorAll("[data-mercado]");

function aplicarMercado(m) {
  document.documentElement.dataset.mercado = m;
  document.documentElement.lang = m === "br" ? "pt-BR" : "pt-PT";
  botoesMercado.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mercado === m)));
}
botoesMercado.forEach((b) =>
  b.addEventListener("click", () => {
    aplicarMercado(b.dataset.mercado);
    try { localStorage.setItem("oddwork-mercado", b.dataset.mercado); } catch { /* sem armazenamento */ }
  })
);
aplicarMercado(document.documentElement.dataset.mercado === "br" ? "br" : "pt");
