// Recebe as candidaturas do site theoddwork.com e guarda-as numa folha do Google.
// Instalação (no geral@theoddwork.com):
//   1. Criar uma Google Sheet "Oddwork · Candidaturas".
//   2. Extensões → Apps Script → colar este ficheiro.
//   3. Implementar → Nova implementação → Aplicação Web
//      Executar como: eu · Quem tem acesso: Qualquer pessoa.
//   4. Copiar o URL /exec para CANDIDATURAS_URL em main.js.

const CAMPOS = [
  "data", "mercado", "nome", "negocio", "pais", "tipo", "whatsapp", "email", "instagram",
  "clientes_novos", "marcacoes", "tempo", "plano", "consentimento", "novidades", "pagina",
];
const AVISAR = "geral@theoddwork.com";

function doPost(e) {
  const p = (e && e.parameter) || {};
  // Armadilha para robôs: o campo "website" está escondido às pessoas
  if (p.website) return responder({ ok: true });
  if (p.consentimento !== "sim" || !p.nome || !p.email || !p.whatsapp) {
    return responder({ ok: false, erro: "dados incompletos" });
  }

  const folha = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (folha.getLastRow() === 0) folha.appendRow(CAMPOS);
  const linha = CAMPOS.map((c) => (c === "data" ? new Date() : limpar(p[c])));

  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    folha.appendRow(linha);
  } finally {
    trava.releaseLock();
  }

  MailApp.sendEmail({
    to: AVISAR,
    subject: `Nova candidatura: ${limpar(p.negocio)} (${limpar(p.pais)})`,
    body: CAMPOS.slice(1).map((c) => `${c}: ${limpar(p[c])}`).join("\n"),
  });
  return responder({ ok: true });
}

// Evita fórmulas injetadas na folha (=, +, -, @ no início) e limita o tamanho
function limpar(v) {
  const s = String(v || "").slice(0, 1000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
