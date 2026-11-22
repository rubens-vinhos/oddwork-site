// Landing page /diagnostico: formulário em 2 passos, origem do anúncio, WhatsApp e eventos.
// Passo 1 grava logo o pedido (nome, WhatsApp, tipo). Passo 2 completa-o (função completar_pedido).
// No computador de teste (localhost) guarda no browser, a não ser que o endereço tenha ?real=1.
(function () {
  "use strict";
  var CFG = window.ODDWORK || {};
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var TESTE = LOCAL && !new URLSearchParams(location.search).has("real");
  var URL_PEDIDOS = CFG.supabaseUrl ? CFG.supabaseUrl + "/rest/v1/pedidos" : "";
  var URL_COMPLETAR = CFG.supabaseUrl ? CFG.supabaseUrl + "/rest/v1/rpc/completar_pedido" : "";
  var OBRIGADO = "/diagnostico/obrigado/";
  var CH_LEAD = "oddwork-lp-lead";
  var CH_ORIGEM = "oddwork-lp-origem";
  var semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ss(k, v) {
    try {
      if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || "null");
      sessionStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  function marcar(nome, dados) { if (window.oddworkMarcar) window.oddworkMarcar(nome, dados || {}); }
  function novoId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.from(b, function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }
  var variante = document.documentElement.dataset.v || "a";

  // ---------- Origem do anúncio (guardada na sessão, primeiro toque) ----------
  (function () {
    var q = new URLSearchParams(location.search);
    var o = {
      utm_source: q.get("utm_source"), utm_medium: q.get("utm_medium"),
      utm_campaign: q.get("utm_campaign"), utm_content: q.get("utm_content"),
      clid: q.get("fbclid") ? "fb:" + q.get("fbclid") : q.get("gclid") ? "g:" + q.get("gclid") : null,
    };
    var tem = Object.keys(o).some(function (k) { return o[k]; });
    if (tem || !ss(CH_ORIGEM)) ss(CH_ORIGEM, o);
  })();
  function origem() { return ss(CH_ORIGEM) || {}; }

  // ---------- WhatsApp ----------
  var TEXTO_WHATS = "Olá, vim do site e quero o diagnóstico grátis";
  document.querySelectorAll("[data-whats]").forEach(function (a) {
    if (!CFG.whatsapp) { a.hidden = true; return; }
    a.href = "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(TEXTO_WHATS);
    a.target = "_blank"; a.rel = "noopener";
    a.addEventListener("click", function () { marcar("Contact", { onde: a.dataset.rastrear || "" }); });
  });

  // ---------- Formulários (o mesmo modelo no topo e no fim) ----------
  var tpl = document.getElementById("tpl-form");
  var caixas = [];
  document.querySelectorAll("[data-form-lugar]").forEach(function (lugar) {
    var html = tpl.innerHTML.replace(/ID-/g, lugar.dataset.formLugar + "-");
    lugar.innerHTML = html;
    caixas.push(lugar.querySelector(".lp-form-caixa"));
  });

  var horasCalc = null;

  function mostrar(caixa, qual) {
    caixa.querySelector('[data-passo="1"]').hidden = qual !== 1;
    caixa.querySelector('[data-passo="2"]').hidden = qual !== 2;
    caixa.querySelector(".lp-form--feito").hidden = qual !== "feito";
  }
  function estadoInicial() {
    var lead = ss(CH_LEAD);
    caixas.forEach(function (c, i) {
      if (!lead) mostrar(c, 1);
      else if (lead.passo === 1 && i === 0) { mostrar(c, 2); preencherNome(c, lead.nome); }
      else mostrar(c, "feito");
    });
  }
  function preencherNome(caixa, nome) {
    var el = caixa.querySelector("[data-nome]");
    if (el) el.textContent = nome ? ", " + nome.split(/\s+/)[0] : "";
  }

  function erro(form, msg) {
    var p = form.querySelector(".form__erro");
    p.textContent = msg || ""; p.hidden = !msg;
  }
  function valorRadio(form, nome) {
    var r = form.querySelector('input[name="' + nome + '"]:checked');
    return r ? r.value : "";
  }
  function telefone(form) {
    var ind = form.indicativo.value;
    var bruto = form.whatsapp.value.trim();
    var dig = bruto.replace(/\D/g, "");
    if (/^(\+|00)/.test(bruto)) { dig = dig.replace(/^00/, ""); return { tel: "+" + dig, digitos: dig, ind: "+" + dig.slice(0, 3) }; }
    var indDig = ind.replace(/\D/g, "");
    if (indDig && dig.indexOf(indDig) === 0 && dig.length > indDig.length + 7) dig = dig.slice(indDig.length);
    return { tel: (ind ? ind + " " : "") + dig, digitos: indDig + dig, ind: ind };
  }

  async function enviarPasso1(form, caixa) {
    erro(form, "");
    form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    var nome = form.nome.value.trim();
    var t = telefone(form);
    var tipo = valorRadio(form, "tipo");
    var falta = [];
    if (!nome) falta.push(form.nome);
    if (t.digitos.length < 8 || t.digitos.length > 15) falta.push(form.whatsapp);
    if (!tipo) falta.push(form.querySelector('[data-obrigatorio="tipo"]'));
    if (falta.length) {
      falta.forEach(function (el) { el.setAttribute("aria-invalid", "true"); });
      (falta[0].matches("fieldset") ? falta[0].querySelector("input") : falta[0]).focus();
      erro(form, falta[0] === form.whatsapp && nome && tipo
        ? "Confirma o número de WhatsApp, com o indicativo certo."
        : "Preenche o nome, o WhatsApp e o tipo de negócio.");
      return;
    }
    if (form.website.value) return; // isco para robôs

    var o = origem();
    var lead = {
      id: novoId(), nome: nome.slice(0, 120), tipo: tipo, whatsapp: t.tel.slice(0, 40),
      pais: t.ind === "+351" ? "Portugal" : t.ind === "+55" ? "Brasil" : null,
      passo: 1, horas_calc: horasCalc,
      pagina: (location.pathname + (variante === "b" ? "?v=b" : "")).slice(0, 200),
      utm_source: o.utm_source || null, utm_medium: o.utm_medium || null,
      utm_campaign: o.utm_campaign || null, utm_content: o.utm_content || null, clid: o.clid || null,
      vid: (window.oddworkVisitante && window.oddworkConsentimento && window.oddworkConsentimento.estatisticas) ? window.oddworkVisitante : null,
    };

    var botao = form.querySelector('button[type="submit"]');
    botao.disabled = true; botao.textContent = "A enviar…";
    try {
      if (TESTE) {
        var lista = JSON.parse(localStorage.getItem("oddwork-pedidos-teste") || "[]");
        lista.push(Object.assign({}, lead, { data: new Date().toISOString(), estado: "novo" }));
        localStorage.setItem("oddwork-pedidos-teste", JSON.stringify(lista));
      } else {
        if (!URL_PEDIDOS) throw new Error("sem-destino");
        var r = await fetch(URL_PEDIDOS, {
          method: "POST",
          headers: { apikey: CFG.supabaseChave, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(lead),
        });
        if (!r.ok) throw new Error(String(r.status));
      }
    } catch (e) {
      erro(form, "Não conseguimos enviar agora. Fala connosco no WhatsApp ou escreve para geral@theoddwork.com.");
      botao.disabled = false; botao.textContent = "Quero o meu diagnóstico grátis";
      return;
    }

    ss(CH_LEAD, { id: lead.id, nome: nome, passo: 1 });
    marcar("Lead", { content_category: tipo, variante: variante });
    if (window.oddworkEvento) window.oddworkEvento("pedido", {});
    caixas.forEach(function (c) { mostrar(c, c === caixa ? 2 : "feito"); });
    preencherNome(caixa, nome);
    var titulo = caixa.querySelector('[data-passo="2"] .lp-form__titulo');
    titulo.focus({ preventScroll: true });
    caixa.scrollIntoView({ behavior: semMovimento ? "auto" : "smooth", block: "start" });
  }

  async function enviarPasso2(form, saltar) {
    var lead = ss(CH_LEAD) || {};
    if (!saltar) {
      var dados = {
        p_id: lead.id, p_negocio: form.negocio.value.trim(), p_clientes: valorRadio(form, "clientes"),
        p_dor: valorRadio(form, "dor"), p_site: form.site.value.trim(),
      };
      var vazio = !dados.p_negocio && !dados.p_clientes && !dados.p_dor && !dados.p_site;
      if (vazio) { erro(form, "Responde a pelo menos uma pergunta, ou carrega em “Saltar este passo”."); return; }
      var botao = form.querySelector('button[type="submit"]');
      botao.disabled = true; botao.textContent = "A enviar…";
      try {
        if (TESTE) {
          var lista = JSON.parse(localStorage.getItem("oddwork-pedidos-teste") || "[]");
          var p = lista.find(function (x) { return x.id === lead.id; });
          if (p) Object.assign(p, { negocio: dados.p_negocio, clientes: dados.p_clientes, dor: dados.p_dor, site: dados.p_site, passo: 2 });
          localStorage.setItem("oddwork-pedidos-teste", JSON.stringify(lista));
        } else if (lead.id && URL_COMPLETAR) {
          await fetch(URL_COMPLETAR, {
            method: "POST",
            headers: { apikey: CFG.supabaseChave, "Content-Type": "application/json" },
            body: JSON.stringify(dados),
          });
        }
      } catch (e) { /* o lead já está gravado; seguimos para a página seguinte */ }
      marcar("lead_qualified", { clientes: dados.p_clientes, dor: dados.p_dor });
    }
    lead.passo = 2;
    ss(CH_LEAD, lead);
    if (window.oddworkIr) window.oddworkIr(OBRIGADO); else location.href = OBRIGADO;
  }

  var comecou = false;
  caixas.forEach(function (caixa) {
    var f1 = caixa.querySelector('[data-passo="1"]');
    var f2 = caixa.querySelector('[data-passo="2"]');
    f1.addEventListener("submit", function (e) { e.preventDefault(); enviarPasso1(f1, caixa); });
    f2.addEventListener("submit", function (e) { e.preventDefault(); enviarPasso2(f2, false); });
    f2.querySelector("[data-saltar]").addEventListener("click", function () { enviarPasso2(f2, true); });
    f1.addEventListener("focusin", function () {
      if (comecou) return;
      comecou = true; marcar("form_start", { onde: caixa.parentElement.dataset.formLugar });
    });
    // Tirar o aviso de erro dos chips quando se escolhe um.
    caixa.addEventListener("change", function (e) {
      var fs = e.target.closest("fieldset[aria-invalid]");
      if (fs) fs.removeAttribute("aria-invalid");
    });
  });
  estadoInicial();

  // ---------- Ir para o formulário ----------
  function irParaForm(e) {
    e.preventDefault();
    var caixa = caixas[0];
    var r = caixa.getBoundingClientRect();
    window.scrollTo({ top: Math.max(0, scrollY + r.top - Math.max(16, (innerHeight - r.height) / 2)), behavior: semMovimento ? "auto" : "smooth" });
    var alvo = caixa.querySelector("form:not([hidden]) input:not([type=hidden]), .lp-form--feito:not([hidden]) a");
    if (alvo) setTimeout(function () { alvo.focus({ preventScroll: true }); }, semMovimento ? 0 : 450);
    var cartao = caixa.querySelector(".lp-form:not([hidden])");
    if (cartao && !semMovimento) {
      cartao.classList.remove("a-chegar"); void cartao.offsetWidth;
      setTimeout(function () { cartao.classList.add("a-chegar"); }, 380);
      setTimeout(function () { cartao.classList.remove("a-chegar"); }, 1900);
    }
  }
  document.querySelectorAll("[data-ir-form]").forEach(function (a) { a.addEventListener("click", irParaForm); });

  // ---------- Calculadora ligada ao formulário ----------
  var horasEl = document.getElementById("calc-horas");
  var horasCta = document.querySelector("[data-calc-horas]");
  if (horasEl && horasCta) {
    var copiar = function () { var n = parseInt(horasEl.textContent, 10); if (!isNaN(n)) horasCta.textContent = n; };
    new MutationObserver(copiar).observe(horasEl, { childList: true, characterData: true, subtree: true });
    document.querySelector("[data-calc-cta]").addEventListener("click", function () {
      var n = parseInt(horasEl.textContent, 10);
      horasCalc = isNaN(n) ? null : Math.max(0, Math.min(2000, n));
    });
    var usou = false;
    ["calc-clientes", "calc-minutos"].forEach(function (id) {
      var r = document.getElementById(id);
      if (r) r.addEventListener("input", function () {
        var n = parseInt(horasEl.textContent, 10);
        horasCalc = isNaN(n) ? horasCalc : n;
        if (!usou) { usou = true; marcar("calc_used", {}); }
      });
    });
  }

  // ---------- Barra fixa no telemóvel ----------
  var barra = document.getElementById("barra-lp");
  if (barra && "IntersectionObserver" in window) {
    var vistos = new Set();
    var alvos = document.querySelectorAll(".lp-hero, .lp-final, .rodape");
    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.isIntersecting ? vistos.add(e.target) : vistos.delete(e.target); });
      var mostrar = vistos.size === 0;
      barra.classList.toggle("visivel", mostrar);
      barra.setAttribute("aria-hidden", String(!mostrar));
      barra.querySelectorAll("a").forEach(function (a) { a.tabIndex = mostrar ? 0 : -1; });
    });
    alvos.forEach(function (a) { obs.observe(a); });
  }

  marcar("ViewContent", { content_name: "diagnostico", variante: variante });
})();
