// Aviso de cookies com 3 categorias: essenciais (sempre), estatísticas e marketing.
// A escolha fica guardada e é anunciada com o evento "oddwork:consentimento".
(function () {
  var CHAVE = "oddwork-cookies";
  var VERSAO = 2; // subir quando as categorias mudarem, para voltar a perguntar
  var aviso = document.getElementById("cookies");
  if (!aviso) return;
  var opcoes = document.getElementById("cookies-opcoes");
  var cxEst = document.getElementById("ck-estatisticas");
  var cxMkt = document.getElementById("ck-marketing");
  var btPers = aviso.querySelector('[data-cookies="personalizar"]');
  var btGuardar = aviso.querySelector('[data-cookies="guardar"]');

  function ler() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE));
      return v && v.v === VERSAO ? v : null;
    } catch (e) { return null; }
  }
  function guardar(est, mkt) {
    var escolha = { v: VERSAO, estatisticas: !!est, marketing: !!mkt, data: new Date().toISOString() };
    try { localStorage.setItem(CHAVE, JSON.stringify(escolha)); } catch (e) { /* sem armazenamento */ }
    window.oddworkConsentimento = escolha;
    document.dispatchEvent(new CustomEvent("oddwork:consentimento", { detail: escolha }));
    fechar();
  }

  function abrir() {
    var atual = ler();
    cxEst.checked = atual ? atual.estatisticas : false;
    cxMkt.checked = atual ? atual.marketing : false;
    aviso.hidden = false;
    aviso.style.animation = "none"; void aviso.offsetWidth; aviso.style.animation = "";
  }
  function fechar() { aviso.hidden = true; mostrarOpcoes(false); }
  function mostrarOpcoes(sim) {
    opcoes.hidden = !sim;
    btGuardar.hidden = !sim;
    aviso.classList.toggle("aberto", sim);
    btPers.setAttribute("aria-expanded", String(sim));
  }

  aviso.addEventListener("click", function (e) {
    var b = e.target.closest("[data-cookies]");
    if (!b) return;
    var acao = b.dataset.cookies;
    if (acao === "aceitar") guardar(true, true);
    else if (acao === "recusar") guardar(false, false);
    else if (acao === "personalizar") { mostrarOpcoes(true); cxEst.focus(); }
    else if (acao === "guardar") guardar(cxEst.checked, cxMkt.checked);
  });
  document.querySelectorAll("[data-abrir-cookies]").forEach(function (b) { b.addEventListener("click", function () { abrir(); mostrarOpcoes(true); }); });

  var escolha = ler();
  window.oddworkConsentimento = escolha;
  if (!escolha) abrir();
})();
