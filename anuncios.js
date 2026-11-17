// Meta Pixel, Google Analytics 4 e Google Ads, ligados ao consentimento de cookies.
// - Sem IDs em config.js, nada é carregado (só fica a função oddworkMarcar, que não faz nada lá fora).
// - Consent Mode v2: tudo começa recusado; muda quando a pessoa escolhe no aviso de cookies.
// - GA4 só com "Estatísticas"; Meta Pixel e Google Ads só com "Marketing".
// Eventos: oddworkMarcar("Lead", { tipo: "Clínica" }) envia para cada ferramenta ligada.
(function () {
  "use strict";
  var CFG = window.ODDWORK || {};
  var temGoogle = !!(CFG.ga4 || CFG.googleAds);

  // ---------- Google (gtag) com Consent Mode v2 ----------
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  if (temGoogle) {
    gtag("consent", "default", {
      ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
      analytics_storage: "denied", wait_for_update: 500,
    });
  }

  function carregar(src) {
    var s = document.createElement("script");
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  var googleCarregado = false;
  function ligarGoogle(c) {
    if (!temGoogle) return;
    gtag("consent", "update", {
      analytics_storage: c.estatisticas ? "granted" : "denied",
      ad_storage: c.marketing ? "granted" : "denied",
      ad_user_data: c.marketing ? "granted" : "denied",
      ad_personalization: c.marketing ? "granted" : "denied",
    });
    if (googleCarregado || !(c.estatisticas || c.marketing)) return;
    googleCarregado = true;
    carregar("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CFG.ga4 || CFG.googleAds));
    gtag("js", new Date());
    if (CFG.ga4) gtag("config", CFG.ga4);
    if (CFG.googleAds) gtag("config", CFG.googleAds);
  }

  // ---------- Meta Pixel ----------
  var metaCarregado = false;
  function ligarMeta(c) {
    if (!CFG.metaPixel || !c.marketing || metaCarregado) return;
    metaCarregado = true;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", CFG.metaPixel);
    window.fbq("track", "PageView");
  }

  function aplicar(c) { if (!c) return; ligarGoogle(c); ligarMeta(c); }
  aplicar(window.oddworkConsentimento);
  document.addEventListener("oddwork:consentimento", function (e) { aplicar(e.detail); });

  // ---------- Eventos ----------
  // Nomes padrão do Meta; os outros vão como personalizados.
  var PADRAO_META = { ViewContent: 1, Lead: 1, Schedule: 1, Contact: 1, CompleteRegistration: 1 };
  // Nomes no GA4 (recomendados quando existem).
  var NOME_GA4 = { ViewContent: "view_item", Lead: "generate_lead", Schedule: "schedule", Contact: "contact", lead_qualified: "lead_qualified", calc_used: "calc_used", form_start: "form_start" };

  window.oddworkMarcar = function (nome, dados) {
    dados = dados || {};
    var c = window.oddworkConsentimento || {};
    try {
      if (window.fbq && c.marketing) {
        if (PADRAO_META[nome]) window.fbq("track", nome, dados); else window.fbq("trackCustom", nome, dados);
      }
      if (temGoogle && googleCarregado) {
        if (CFG.ga4 && c.estatisticas) gtag("event", NOME_GA4[nome] || nome, dados);
        if (CFG.googleAds && CFG.googleAdsLead && c.marketing && nome === "Lead") {
          gtag("event", "conversion", { send_to: CFG.googleAds + "/" + CFG.googleAdsLead });
        }
      }
    } catch (e) { /* nunca partir a página por causa de uma ferramenta de anúncios */ }
    // O nosso registo (painel), quando há autorização de estatísticas.
    if (window.oddworkEvento) window.oddworkEvento("lp-" + nome, dados);
  };
})();
