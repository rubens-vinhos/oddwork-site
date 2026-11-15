// Registo de visitas da Oddwork.
// Sem autorização: só um evento anónimo por página (sem identificador, sem nada guardado no aparelho).
// Com "Estatísticas": identificador do visitante, origem, secções vistas, cliques, scroll,
// tempo e passos do formulário (nunca o texto escrito). O pedido de diagnóstico leva o
// identificador, para o painel mostrar o percurso dessa pessoa.
(function () {
  "use strict";
  var CFG = window.ODDWORK || {};
  var EVENTOS_URL = CFG.supabaseUrl ? CFG.supabaseUrl + "/rest/v1/eventos" : ""; // vazio = guarda no browser (teste)
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var CH_TESTE = "oddwork-eventos-teste";

  function consentiu() { var c = window.oddworkConsentimento; return !!(c && c.estatisticas); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function novoId() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); }

  function aparelho() {
    var ua = navigator.userAgent;
    var tipo = /iPad|Tablet/i.test(ua) ? "Tablet" : /Mobi|Android|iPhone/i.test(ua) ? "Telemóvel" : "Computador";
    var browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Outro";
    var so = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Outro";
    var fuso = ""; try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* sem Intl */ }
    return { tipo: tipo, browser: browser, so: so, ecra: screen.width + "×" + screen.height, idioma: navigator.language || "", fuso: fuso };
  }

  function origem() {
    var q = new URLSearchParams(location.search);
    var ref = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : "";
    var host = ""; try { host = ref ? new URL(ref).hostname.replace(/^www\./, "") : ""; } catch (e) { /* inválido */ }
    var fonte = q.get("utm_source") || "";
    var canal =
      /instagram/i.test(fonte + host) ? "Instagram" :
      /tiktok/i.test(fonte + host) ? "TikTok" :
      /youtube|youtu\.be/i.test(fonte + host) ? "YouTube" :
      /facebook|fb\./i.test(fonte + host) ? "Facebook" :
      /mail|email/i.test(fonte) ? "Email" :
      /whatsapp|wa\.me/i.test(fonte + host) ? "WhatsApp" :
      /google|bing|duckduckgo/i.test(fonte + host) ? "Pesquisa" :
      fonte ? fonte : host ? "Outro site" : "Direto";
    return { canal: canal, ref: host, campanha: q.get("utm_campaign") || "", conteudo: q.get("utm_content") || "" };
  }

  // ---------- Envio ----------
  var fila = [];
  function enviar(ev) {
    ev.t = new Date().toISOString();
    ev.pagina = location.pathname;
    ev.mercado = document.documentElement.dataset.mercado || "pt";
    if (EVENTOS_URL) {
      fila.push(ev);
      if (fila.length >= 8 || ev.tipo === "saida" || ev.tipo === "pedido") despejar();
    } else if (LOCAL) {
      var lista = []; try { lista = JSON.parse(localStorage.getItem(CH_TESTE) || "[]"); } catch (e) { /* vazio */ }
      lista.push(ev);
      try { localStorage.setItem(CH_TESTE, JSON.stringify(lista.slice(-5000))); } catch (e) { /* cheio */ }
    }
  }
  function despejar() {
    if (!fila.length || !EVENTOS_URL) return;
    // Formato da tabela: colunas fixas + o resto em "dados".
    var linhas = fila.splice(0).map(function (e) {
      var dados = {};
      Object.keys(e).forEach(function (k) { if (["tipo", "vid", "sid", "pagina", "mercado", "t"].indexOf(k) < 0) dados[k] = e[k]; });
      return { tipo: e.tipo, vid: e.vid || null, sid: e.sid || null, pagina: e.pagina || null, mercado: e.mercado === "br" ? "br" : "pt", dados: dados };
    });
    fetch(EVENTOS_URL, {
      method: "POST", keepalive: true, body: JSON.stringify(linhas),
      headers: { apikey: CFG.supabaseChave, "Content-Type": "application/json", Prefer: "return=minimal" },
    }).catch(function () {});
  }

  setInterval(despejar, 8000);

  // ---------- Contagem anónima (sempre) ----------
  var o0 = origem();
  var a0 = aparelho();
  enviar({ tipo: "visita-anonima", canal: o0.canal, aparelho: a0.tipo });

  // ---------- Seguimento com autorização ----------
  var ligado = false;
  var vid, sid, inicio = Date.now(), scrollMax = 0, vistas = {};

  function ligar() {
    if (ligado || !consentiu()) return;
    ligado = true;
    vid = ls("oddwork-vid");
    var primeira = !vid;
    if (!vid) { vid = novoId(); ls("oddwork-vid", vid); ls("oddwork-primeira", new Date().toISOString()); ls("oddwork-origem1", JSON.stringify(o0)); }
    sid = ss("oddwork-sid");
    var novaSessao = !sid;
    if (!sid) { sid = novoId(); ss("oddwork-sid", sid); ls("oddwork-visitas", String(Number(ls("oddwork-visitas") || 0) + 1)); }
    window.oddworkVisitante = vid;

    var base = { vid: vid, sid: sid };
    function ev(tipo, extra) { if (!consentiu()) return; var e = { tipo: tipo }; for (var k in base) e[k] = base[k]; for (var j in extra) e[j] = extra[j]; enviar(e); }
    window.oddworkEvento = ev;

    if (novaSessao) ev("sessao", { primeira: primeira, visitas: Number(ls("oddwork-visitas")), origem: o0, aparelho: a0 });
    ev("pagina", { titulo: document.title });

    // Secções vistas (uma vez por sessão e página)
    var nomes = { "para-quem": "Para quem", sistema: "O que construímos", como: "Como funciona", preco: "Preço", perguntas: "Perguntas", diagnostico: "Formulário" };
    // Conta a secção quando ela passa pelo meio do ecrã (verificação leve no scroll).
    var alvos = Object.keys(nomes).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var pendente = false;
    function verSecoes() {
      pendente = false;
      var meio = innerHeight / 2;
      alvos.forEach(function (el) {
        if (vistas[el.id]) return;
        var r = el.getBoundingClientRect();
        if (r.top < meio && r.bottom > meio) { vistas[el.id] = 1; ev("secao", { secao: nomes[el.id] }); }
      });
    }
    addEventListener("scroll", function () { if (!pendente) { pendente = true; setTimeout(verSecoes, 250); } }, { passive: true });
    verSecoes();

    // Scroll máximo
    addEventListener("scroll", function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      if (h > 0) scrollMax = Math.max(scrollMax, Math.round((scrollY / h) * 100));
    }, { passive: true });

    // Cliques
    document.addEventListener("click", function (e) {
      var r = e.target.closest("[data-rastrear]");
      if (r) ev("clique", { alvo: r.dataset.rastrear });
      var m = e.target.closest(".mercado [data-mercado]");
      if (m) ev("clique", { alvo: "pais-" + m.dataset.mercado });
      var s = e.target.closest("details > summary");
      if (s && !s.parentElement.open) ev("pergunta", { pergunta: s.textContent.trim() });
    });

    // Formulário: só o nome do campo, nunca o valor
    var form = document.getElementById("formulario");
    if (form) {
      var tocados = {};
      var tocar = function (e) {
        var n = e.target.name;
        if (n && !tocados[n] && n !== "website" && n !== "pais") { tocados[n] = 1; ev("form-campo", { campo: n }); }
      };
      form.addEventListener("focusin", tocar);
      form.addEventListener("change", tocar);
    }

    // Saída: tempo na página e scroll
    var saiu = false;
    function sair() { if (saiu) return; saiu = true; ev("saida", { segundos: Math.round((Date.now() - inicio) / 1000), scroll: scrollMax }); despejar(); }
    addEventListener("pagehide", sair);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { sair(); } else { saiu = false; inicio = Date.now(); } });
  }

  ligar();
  document.addEventListener("oddwork:consentimento", function (e) {
    enviar({ tipo: "consentimento", estatisticas: e.detail.estatisticas, marketing: e.detail.marketing });
    if (e.detail.estatisticas) ligar();
    else if (!e.detail.estatisticas) {
      // Retirou a autorização: apaga o identificador deste aparelho.
      ["oddwork-vid", "oddwork-primeira", "oddwork-origem1", "oddwork-visitas"].forEach(function (k) { try { localStorage.removeItem(k); } catch (x) { /* nada */ } });
      try { sessionStorage.removeItem("oddwork-sid"); } catch (x) { /* nada */ }
    }
  });
})();
