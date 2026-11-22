// Calendário da chamada de diagnóstico (página /diagnostico/obrigado/).
// Horários em hora de Portugal, chamadas de 20 min de 30 em 30 min:
//   domingo e segunda 09:00–19:30 · terça e quarta 09:00–14:00 (acaba antes das 14:30).
// A mesma regra está no servidor (scripts/supabase-marcacoes.sql).
// No computador de teste (localhost sem ?real=1) guarda no browser.
(function () {
  "use strict";
  var raiz = document.getElementById("marcar");
  if (!raiz) return;
  var CFG = window.ODDWORK || {};
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var TESTE = LOCAL && !new URLSearchParams(location.search).has("real");
  var API = CFG.supabaseUrl ? CFG.supabaseUrl + "/rest/v1/rpc/" : "";
  var semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FUSO_PT = "Europe/Lisbon";
  var DIAS = 15, ANTECEDENCIA = 2 * 3600e3, PASSO = 30, DURACAO = 20;
  // dia da semana (0 = domingo) → [primeira, última] hora de início, em minutos
  var HORARIO = { 0: [540, 1170], 1: [540, 1170], 2: [540, 840], 3: [540, 840] };

  var lead = null;
  try { lead = JSON.parse(sessionStorage.getItem("oddwork-lp-lead")); } catch (e) { /* sem sessão */ }
  var $ = function (s) { return raiz.querySelector(s); };
  var espera = function (ms) { return new Promise(function (r) { setTimeout(r, semMovimento ? 0 : ms); }); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  // ---------- Hora de Portugal ----------
  var fmtPT = new Intl.DateTimeFormat("en-US", { timeZone: FUSO_PT, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
  function partesPT(ms) {
    var o = {};
    fmtPT.formatToParts(new Date(ms)).forEach(function (p) { if (p.type !== "literal") o[p.type] = +p.value; });
    return o;
  }
  function desvioPT(ms) { var p = partesPT(ms); return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000; }
  function instantePT(a, m, d, min) {
    var g = Date.UTC(a, m, d, 0, min), t = g - desvioPT(g), o2 = desvioPT(t);
    return g - o2;
  }

  var meuFuso = "";
  try { meuFuso = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* sem Intl */ }
  var agora0 = Date.now();
  var mesmoFuso = new Date(agora0).getTimezoneOffset() === -desvioPT(agora0) / 60000;
  var fmtHora = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });
  var fmtHoraPT = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: FUSO_PT });
  var NOMES_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var NOMES_DIA_LONGO = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  // ---------- Dias e horas livres ----------
  var ocupados = {};
  function construirDias() {
    var agora = Date.now(), hoje = partesPT(agora), lista = [];
    for (var i = 0; i < DIAS; i++) {
      var u = new Date(Date.UTC(hoje.year, hoje.month - 1, hoje.day + i));
      var a = u.getUTCFullYear(), m = u.getUTCMonth(), d = u.getUTCDate(), sem = u.getUTCDay();
      var h = HORARIO[sem], horas = [];
      if (h) for (var min = h[0]; min <= h[1]; min += PASSO) {
        var t = instantePT(a, m, d, min);
        if (t >= agora + ANTECEDENCIA && !ocupados[t]) horas.push(t);
      }
      lista.push({ a: a, m: m, d: d, sem: sem, horas: horas, chave: a + "-" + (m + 1) + "-" + d });
    }
    return lista;
  }

  async function lerOcupados() {
    ocupados = {};
    try {
      var lista;
      if (TESTE) lista = JSON.parse(localStorage.getItem("oddwork-marcacoes-teste") || "[]");
      else {
        if (!API) return false;
        var r = await fetch(API + "horarios_ocupados", { method: "POST", headers: { apikey: CFG.supabaseChave, "Content-Type": "application/json" }, body: "{}" });
        if (!r.ok) return false;
        lista = await r.json();
      }
      lista.forEach(function (x) { var t = Date.parse(typeof x === "string" ? x : x.horarios_ocupados); if (!isNaN(t)) ocupados[t] = 1; });
      return true;
    } catch (e) { return false; }
  }

  async function gravar(t) {
    var iso = new Date(t).toISOString();
    if (TESTE) {
      var l = JSON.parse(localStorage.getItem("oddwork-marcacoes-teste") || "[]");
      if (l.some(function (x) { return Date.parse(x) === t; })) return "ocupado";
      if (lead && lead.marcado) l = l.filter(function (x) { return x !== lead.marcado; });
      l.push(iso);
      localStorage.setItem("oddwork-marcacoes-teste", JSON.stringify(l));
      await espera(700);
      return "ok";
    }
    if (!API || !lead || !lead.id) return "sem-servidor";
    try {
      var r = await fetch(API + "marcar_diagnostico", { method: "POST", headers: { apikey: CFG.supabaseChave, "Content-Type": "application/json" }, body: JSON.stringify({ p_id: lead.id, p_inicio: iso }) });
      if (!r.ok) return "sem-servidor";
      return await r.json();
    } catch (e) { return "sem-servidor"; }
  }

  // ---------- Textos ----------
  function nomeDia(d) { return NOMES_DIA_LONGO[d.sem] + ", " + d.d + " de " + MESES[d.m]; }
  function horaMostrar(t) { return fmtHora.format(new Date(t)); }
  function frasePT(t) {
    var p = partesPT(t), sem = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    return NOMES_DIA[sem] + ", " + p.day + " de " + MESES[p.month - 1] + ", às " + fmtHoraPT.format(new Date(t));
  }
  function textoWhats(t) {
    var nome = lead && lead.nome ? lead.nome.trim().split(/\s+/)[0] : "";
    var ola = nome ? "Olá, sou " + nome + "." : "Olá.";
    return t ? ola + " Pedi o diagnóstico grátis no site e queria marcar para " + frasePT(t) + " (hora de Portugal)."
             : ola + " Pedi o diagnóstico grátis no site, mas nenhum dos horários me dá jeito. Podemos combinar outro?";
  }
  function linkWhats(t) { return CFG.whatsapp ? "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(textoWhats(t)) : ""; }

  // ---------- Desenho ----------
  var dias = [], diaSel = null, horaSel = null, servidor = true;
  var grelha = $(".cal__dias"), lista = $(".cal__lista"), confirmar = $(".cal__confirmar");

  function desenharMes() {
    dias = construirDias();
    var p0 = dias[0], ult = dias[dias.length - 1];
    $("[data-mes]").textContent = p0.m === ult.m ? MESES[p0.m] + " " + p0.a : MESES[p0.m] + " – " + MESES[ult.m] + " " + ult.a;
    grelha.textContent = "";
    var vazio = (p0.sem + 6) % 7; // semanas começam à segunda
    for (var v = 0; v < vazio; v++) grelha.appendChild(el("span", "cal__dia cal__dia--fora"));
    var primeiroLivre = null;
    dias.forEach(function (d, i) {
      var b = el("button", "cal__dia");
      b.type = "button";
      b.style.setProperty("--i", i + vazio);
      b.dataset.dia = d.chave;
      var n = el("span", "cal__num", d.d);
      b.appendChild(n);
      if (d.horas.length) {
        var pts = el("span", "cal__pontos"); var k = Math.min(3, Math.ceil(d.horas.length / 7));
        for (var j = 0; j < k; j++) pts.appendChild(el("i"));
        b.appendChild(pts);
        b.setAttribute("aria-label", nomeDia(d) + ", " + d.horas.length + " horários livres");
        if (!primeiroLivre) primeiroLivre = d;
      } else {
        b.disabled = true;
        b.setAttribute("aria-label", nomeDia(d) + ", sem horários");
      }
      if (i === 0) b.classList.add("cal__dia--hoje");
      b.addEventListener("click", function () { escolherDia(d, true); });
      grelha.appendChild(b);
    });
    if (!semMovimento) { raiz.classList.remove("cal--entra"); void raiz.offsetWidth; raiz.classList.add("cal--entra"); }
    if (primeiroLivre) escolherDia(primeiroLivre, false);
    else { lista.textContent = ""; $("[data-dia-nome]").textContent = "Não há horários livres nos próximos dias."; }
  }

  function escolherDia(d, doUtilizador) {
    if (diaSel === d && doUtilizador) return;
    diaSel = d; horaSel = null;
    fecharConfirmar();
    grelha.querySelectorAll(".cal__dia").forEach(function (b) {
      var sim = b.dataset.dia === d.chave;
      b.classList.toggle("cal__dia--sel", sim);
      if (b.tagName === "BUTTON") b.setAttribute("aria-pressed", sim ? "true" : "false");
    });
    var nome = $("[data-dia-nome]");
    nome.textContent = nomeDia(d);
    nome.classList.remove("cal--troca"); void nome.offsetWidth; nome.classList.add("cal--troca");
    lista.textContent = "";
    d.horas.forEach(function (t, i) {
      var b = el("button", "cal__hora", horaMostrar(t));
      b.type = "button";
      b.style.setProperty("--i", i);
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { escolherHora(t, b); });
      lista.appendChild(b);
    });
    lista.scrollTop = 0;
    lista.classList.remove("cal--troca"); void lista.offsetWidth; lista.classList.add("cal--troca");
  }

  function escolherHora(t, b) {
    horaSel = t;
    lista.querySelectorAll(".cal__hora").forEach(function (x) { var s = x === b; x.classList.toggle("cal__hora--sel", s); x.setAttribute("aria-pressed", s ? "true" : "false"); });
    var fim = t + DURACAO * 60e3;
    var esc = $("[data-escolha]"); esc.textContent = nomeDia(diaSel) + " · ";
    esc.appendChild(el("span", "cal__nw", horaMostrar(t) + "–" + horaMostrar(fim)));
    $("[data-escolha-pt]").textContent = mesmoFuso ? "" : "Em Portugal: " + fmtHoraPT.format(new Date(t));
    confirmar.hidden = false;
    requestAnimationFrame(function () { confirmar.classList.add("cal__confirmar--aberto"); });
    if (matchMedia("(max-width: 900px)").matches) {
      setTimeout(function () {
        var r = confirmar.getBoundingClientRect();
        if (r.bottom > innerHeight - 12) scrollBy({ top: r.bottom - innerHeight + 24, behavior: semMovimento ? "auto" : "smooth" });
      }, 260);
    }
  }
  function fecharConfirmar() { confirmar.classList.remove("cal__confirmar--aberto"); confirmar.hidden = true; }

  // ---------- Confirmar ----------
  var botao = $("[data-confirmar]");
  botao.addEventListener("click", async function () {
    if (!horaSel || botao.disabled) return;
    var t = horaSel;
    botao.disabled = true; botao.classList.add("a-enviar"); botao.setAttribute("aria-busy", "true");
    $(".cal__erro").hidden = true;
    var r = await gravar(t);
    botao.removeAttribute("aria-busy");
    if (r === "ok") {
      botao.classList.add("a-feito");
      await espera(550);
      if (lead) { lead.marcado = new Date(t).toISOString(); try { sessionStorage.setItem("oddwork-lp-lead", JSON.stringify(lead)); } catch (e) { /* nada */ } }
      if (window.oddworkEvento) window.oddworkEvento("marcou", {});
      if (window.oddworkMarcar) window.oddworkMarcar("Schedule", {});
      mostrarFeito(t, true);
    } else if (r === "ocupado") {
      erroMsg("Alguém marcou esta hora agora mesmo. Escolhe outra, por favor.");
      await lerOcupados(); var chave = diaSel && diaSel.chave; desenharMes();
      var mesmo = dias.find(function (d) { return d.chave === chave && d.horas.length; }); if (mesmo) escolherDia(mesmo, true);
    } else if (r === "sem-servidor" || !servidor) {
      // Sem ligação ao servidor (ou sem pedido nesta sessão): segue pelo WhatsApp com a hora escolhida.
      var w = linkWhats(t);
      if (w) { window.open(w, "_blank", "noopener"); erroMsg("Abrimos o WhatsApp com a hora escolhida. É só enviar a mensagem."); }
      else erroMsg("Não conseguimos marcar agora. Escreve para geral@theoddwork.com com a hora que preferes.");
    } else {
      erroMsg("Esta hora já não está disponível. Escolhe outra, por favor.");
      await lerOcupados(); desenharMes();
    }
    botao.disabled = false; botao.classList.remove("a-enviar", "a-feito");
  });
  function erroMsg(m) { var p = $(".cal__erro"); p.textContent = m; p.hidden = false; }

  // ---------- Marcado ----------
  function mostrarFeito(t, animar) {
    var feito = $(".cal__feito");
    $("[data-feito-quando]").textContent = frasePT(t).replace(/^./, function (c) { return c.toUpperCase(); }) + (mesmoFuso ? "" : " (hora de Portugal)");
    $("[data-feito-local]").textContent = mesmoFuso ? "" : "No teu fuso: " + horaMostrar(t) + ".";
    $("[data-ics]").onclick = function () { baixarICS(t); };
    raiz.classList.add("cal--marcado");
    $(".cal__escolher").hidden = true;
    feito.hidden = false;
    if (animar && !semMovimento) { feito.classList.remove("cal__feito--entra"); void feito.offsetWidth; feito.classList.add("cal__feito--entra"); faiscas(); }
    document.querySelectorAll("[data-falta-marcar]").forEach(function (e) { e.hidden = true; });
    document.querySelectorAll("[data-ja-marcado]").forEach(function (e) { e.hidden = false; });
    var q = document.querySelector("[data-quando-topo]"); if (q) q.textContent = frasePT(t);
    if (animar) feito.querySelector("h3").focus({ preventScroll: true });
  }
  $("[data-mudar]").addEventListener("click", function () {
    raiz.classList.remove("cal--marcado");
    $(".cal__feito").hidden = true;
    $(".cal__escolher").hidden = false;
    document.querySelectorAll("[data-falta-marcar]").forEach(function (e) { e.hidden = false; });
    document.querySelectorAll("[data-ja-marcado]").forEach(function (e) { e.hidden = true; });
    desenharMes();
  });

  function faiscas() {
    var c = $(".cal__faiscas"); c.textContent = "";
    for (var i = 0; i < 18; i++) {
      var f = el("i"), ang = (i / 18) * Math.PI * 2 + Math.random() * .3, dist = 70 + Math.random() * 60;
      f.style.setProperty("--x", (Math.cos(ang) * dist).toFixed(1) + "px");
      f.style.setProperty("--y", (Math.sin(ang) * dist).toFixed(1) + "px");
      f.style.setProperty("--d", (Math.random() * 120).toFixed(0) + "ms");
      c.appendChild(f);
    }
  }

  // Ficheiro de calendário (.ics) para o telemóvel ou o computador.
  function baixarICS(t) {
    var f = function (ms) { return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Oddwork//Diagnostico//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT", "UID:" + t + "-diagnostico@theoddwork.com", "DTSTAMP:" + f(Date.now()), "DTSTART:" + f(t), "DTEND:" + f(t + DURACAO * 60e3),
      "SUMMARY:Diagnóstico grátis com a Oddwork", "DESCRIPTION:Videochamada de 20 minutos. O link chega pelo WhatsApp.",
      "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Diagnóstico com a Oddwork", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = "diagnostico-oddwork.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  // ---------- Arranque ----------
  $("[data-fuso]").textContent = mesmoFuso ? "Horas de Portugal." : "Horas no teu fuso horário" + (meuFuso ? " (" + meuFuso.split("/").pop().replace(/_/g, " ") + ")" : "") + ".";
  var w0 = linkWhats(null), aw = $("[data-whats-cal]");
  if (w0) { aw.href = w0; aw.target = "_blank"; aw.rel = "noopener"; } else aw.parentElement.hidden = true;

  (async function () {
    servidor = await lerOcupados();
    if (lead && lead.marcado && Date.parse(lead.marcado) > Date.now()) { desenharMes(); mostrarFeito(Date.parse(lead.marcado), false); }
    else desenharMes();
    raiz.classList.add("cal--pronto");
  })();
})();
