// Escolhe o mercado (pt ou br) antes de a página aparecer.
// Ordem: escolha guardada → idioma do browser → fuso horário → Portugal.
(function () {
  var m = null;
  try { m = localStorage.getItem("oddwork-mercado"); } catch (e) { /* sem armazenamento */ }
  if (m !== "pt" && m !== "br") {
    var linguas = navigator.languages || [navigator.language || ""];
    var fuso = "";
    try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* sem Intl */ }
    if (linguas.some(function (l) { return /^pt-br/i.test(l); })) m = "br";
    else if (linguas.some(function (l) { return /^pt-pt/i.test(l); })) m = "pt";
    else if (/^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Maceio|Santarem|Noronha|Eirunepe)$/.test(fuso)) m = "br";
    else m = "pt";
  }
  document.documentElement.classList.add("js");
  document.documentElement.dataset.mercado = m;
  document.documentElement.lang = m === "br" ? "pt-BR" : "pt-PT";
})();
