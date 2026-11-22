// Ecrã de carregamento e transições entre páginas (ver transicao.css).
// Corre logo no início do <body>, a seguir ao .carregador.
(function () {
  var d = document.documentElement;
  var el = document.querySelector("[data-carregador]");
  if (!el) return;
  var semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var simbolo = el.querySelector(".carregador__simbolo");
  var barra = el.querySelector(".carregador__barra");
  var inicio = performance.now();
  var minimo = d.classList.contains("primeira-vez") ? 1500 : 450;

  function fim() { d.classList.remove("a-carregar", "a-revelar", "primeira-vez"); }
  if (semMovimento) { fim(); return; }

  // Barra de progresso: avança sozinha até ~90 % e completa quando a página está pronta.
  var p = 0, pronta = false;
  (function avancar() {
    if (!d.classList.contains("a-carregar")) return;
    p = pronta ? 1 : p + (0.9 - p) * 0.06;
    barra.style.setProperty("--p", p.toFixed(3));
    if (p < 1) requestAnimationFrame(avancar);
  })();

  // O logo do topo (3D) está pronto? Espera um pouco por ele, sem nunca bloquear.
  function esperarLogo(feito) {
    var logo = document.querySelector("[data-logo3d]");
    if (!logo || !logo.getClientRects().length) return feito();
    var limite = performance.now() + 1800;
    (function ver() {
      if (logo.classList.contains("lp-logo3d--pronto") || performance.now() > limite) feito();
      else setTimeout(ver, 60);
    })();
  }

  // Para onde o símbolo voa: o logo do topo, se estiver no ecrã.
  function voarAteAoLogo() {
    var logo = document.querySelector("[data-logo3d]");
    var a = simbolo.getBoundingClientRect();
    if (!logo || !a.width) return;
    var b = logo.getBoundingClientRect();
    if (!b.width || b.bottom < 0 || b.top > innerHeight) return;
    var lado = Math.min(b.width, b.height) * 0.86;
    simbolo.style.setProperty("--tx", (b.left + b.width / 2 - (a.left + a.width / 2)) + "px");
    simbolo.style.setProperty("--ty", (b.top + b.height / 2 - (a.top + a.height / 2)) + "px");
    simbolo.style.setProperty("--s", (lado / a.width).toFixed(3));
  }

  function revelar() {
    pronta = true;
    barra.style.setProperty("--p", "1");
    var falta = Math.max(0, minimo - (performance.now() - inicio));
    setTimeout(function () {
      voarAteAoLogo();
      d.classList.add("a-revelar");
      setTimeout(fim, 1150);
    }, falta + 180);
  }

  function quandoCarregar() { esperarLogo(revelar); }
  if (document.readyState === "complete") quandoCarregar();
  else addEventListener("load", quandoCarregar, { once: true });
  // Rede muito lenta: ao fim de 6 s mostra o site na mesma.
  setTimeout(function () { if (!pronta) revelar(); }, 6000);

  // ---------- Sair para outra página do site ----------
  var aSair = false;
  function irPara(url) {
    if (aSair) return;
    aSair = true;
    simbolo.style.removeProperty("--tx"); simbolo.style.removeProperty("--ty"); simbolo.style.removeProperty("--s");
    d.classList.remove("a-carregar", "a-revelar", "primeira-vez");
    d.classList.add("a-sair");
    setTimeout(function () { location.href = url; }, 480);
  }
  window.oddworkIr = irPara;

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download") || a.hasAttribute("data-whats")) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // só muda de secção
    e.preventDefault();
    irPara(url.href);
  });

  // Botões: onda de luz a partir do sítio onde se tocou.
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest && e.target.closest(".botao");
    if (!b || e.button > 0) return;
    var r = b.getBoundingClientRect();
    var o = document.createElement("span");
    o.className = "botao__onda";
    o.style.left = (e.clientX - r.left) + "px";
    o.style.top = (e.clientY - r.top) + "px";
    o.style.setProperty("--r", (Math.hypot(r.width, r.height) * 2 / 12).toFixed(1));
    b.appendChild(o);
    setTimeout(function () { o.remove(); }, 750);
  }, { passive: true });

  // Voltar atrás (página guardada pelo browser): tira o ecrã escuro.
  addEventListener("pageshow", function (e) {
    if (e.persisted) { aSair = false; d.classList.remove("a-sair", "a-carregar", "a-revelar"); }
  });
})();
