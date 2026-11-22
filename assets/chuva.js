// Chuva de símbolos: ao clicar num link com [data-chuva], caem símbolos da Oddwork até cobrirem o ecrã
// e abre a página. Na página nova, os símbolos continuam a cair para fora e revelam-na.
(function () {
  var semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CHAVE = "oddwork-chuva";
  var SIMBOLO = '<svg viewBox="-420 -420 840 840" aria-hidden="true"><g fill="#F4F5F9">' +
    [0, 120, 240].map(function (r) {
      return '<g transform="rotate(' + r + ')"><polygon points="-8,-78 -34,-82 -60,-198 -42,-332 -8,-376"/><polygon points="8,-78 34,-82 60,-198 42,-332 8,-376"/><polygon points="-50,-92 -76,-212 -118,-136 -100,-102"/><polygon points="50,-92 76,-212 118,-136 100,-102"/></g>';
    }).join("") + '</g><circle r="48" fill="#F26A21"/></svg>';

  // Posições em grelha desencontrada, com semente: as mesmas nas duas páginas.
  function grelha() {
    var w = innerWidth, h = innerHeight, lado = Math.max(90, Math.min(190, Math.min(w, h) / 4.2));
    var passo = lado * 0.78, cols = Math.ceil(w / passo) + 1, linhas = Math.ceil(h / passo) + 1, s = 11, out = [];
    function rnd() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }
    for (var j = 0; j < linhas; j++) for (var i = 0; i < cols; i++) {
      out.push({
        x: i * passo - passo / 2 + (j % 2 ? passo / 2 : 0) + (rnd() - 0.5) * passo * 0.3,
        y: h - (j + 1) * passo + passo / 2 + (rnd() - 0.5) * passo * 0.3,
        rot: rnd() * 360, giro: (rnd() - 0.5) * 220, lado: lado * (0.9 + rnd() * 0.25), linha: j, r: rnd()
      });
    }
    return out;
  }

  function montar() {
    var c = document.createElement("div");
    c.className = "chuva";
    c.setAttribute("aria-hidden", "true");
    c.innerHTML = '<div class="chuva__fundo"></div>';
    var ps = grelha();
    ps.forEach(function (p) {
      var e = document.createElement("div");
      e.className = "chuva__s";
      e.style.cssText = "left:" + p.x + "px;top:" + p.y + "px;width:" + p.lado + "px;height:" + p.lado + "px;margin:" + (-p.lado / 2) + "px 0 0 " + (-p.lado / 2) + "px";
      e.innerHTML = SIMBOLO;
      c.appendChild(e);
      p.el = e;
    });
    document.body.appendChild(c);
    return { c: c, ps: ps };
  }

  // Cair e cobrir: de baixo para cima, como se se empilhassem.
  function cobrir(url) {
    var m = montar(), dur = 0, h = innerHeight;
    m.c.querySelector(".chuva__fundo").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 250, easing: "ease-in", fill: "both" });
    m.ps.forEach(function (p) {
      var atraso = p.linha * 70 + p.r * 260, d = 620 + p.r * 160;
      dur = Math.max(dur, atraso + d);
      p.el.animate([
        { transform: "translateY(" + (-(p.y + p.lado + h * 0.25)) + "px) rotate(" + (p.rot - p.giro) + "deg)", opacity: 1 },
        { transform: "translateY(6px) rotate(" + (p.rot - p.giro * 0.04) + "deg)", offset: 0.82 },
        { transform: "translateY(0) rotate(" + p.rot + "deg)", opacity: 1 }
      ], { duration: d, delay: atraso, easing: "cubic-bezier(.55,0,.85,.36)", fill: "both" });
    });
    try { sessionStorage.setItem(CHAVE, "1"); } catch (e) {}
    setTimeout(function () { location.href = url; }, dur + 120);
  }

  // Chegar: os símbolos continuam a cair para fora do ecrã e a página aparece por trás.
  function revelar() {
    var m = montar(), h = innerHeight, fim = 0;
    m.c.classList.add("chuva--chegou");
    m.ps.forEach(function (p) {
      var atraso = 80 + (1 - Math.min(1, Math.max(0, p.y / h))) * 320 + p.r * 240, d = 720 + p.r * 260;
      fim = Math.max(fim, atraso + d);
      p.el.animate([
        { transform: "translateY(0) rotate(" + p.rot + "deg)" },
        { transform: "translateY(" + (h - p.y + p.lado + h * 0.15) + "px) rotate(" + (p.rot + p.giro * 0.8) + "deg)" }
      ], { duration: d, delay: Math.max(0, atraso), easing: "cubic-bezier(.5,0,.9,.5)", fill: "both" });
    });
    m.c.querySelector(".chuva__fundo").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 200, easing: "ease-out", fill: "both" });
    document.documentElement.classList.add("chuva-a-revelar");
    setTimeout(function () { m.c.remove(); document.documentElement.classList.remove("chuva-a-revelar"); }, fim + 80);
  }

  var chegou = false;
  try { chegou = sessionStorage.getItem(CHAVE) === "1"; sessionStorage.removeItem(CHAVE); } catch (e) {}
  if (chegou && !semMovimento) {
    if (document.body) revelar(); else document.addEventListener("DOMContentLoaded", revelar);
  }

  // Captura: corre antes da transição normal entre páginas.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-chuva]");
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || semMovimento) return;
    e.preventDefault();
    e.stopPropagation();
    if (document.querySelector(".chuva")) return;
    cobrir(a.href);
  }, true);

  // Voltar atrás (página guardada pelo browser): tira a chuva que ficou.
  addEventListener("pageshow", function (e) { if (e.persisted) { var c = document.querySelector(".chuva"); if (c) c.remove(); } });
})();
