// Incomum.eu · recebe os avisos do Stripe (destino "Incomum loja") e atualiza a encomenda.
// Sem verificação de JWT (o Stripe assina). Segredo: STRIPE_INCOMUM_WEBHOOK (whsec_…).
// Quando a encomenda fica paga: cria a conta do cliente (já confirmada, para entrar com link mágico) e envia o e-mail
// de confirmação pelo SMTP do Google Workspace. Segredos: INCOMUM_SMTP_USER (ex.: geral@theoddwork.com) e
// INCOMUM_SMTP_PASS (palavra-passe de aplicação). Sem eles, a encomenda fica paga na mesma e o e-mail não sai.
// O destino recebe os eventos de checkout de TODA a conta: o que não tiver metadata loja=incomum é ignorado com 200.
import Stripe from "npm:stripe@23.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

function chaveServidor(): string {
  try {
    const j = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const k = j.default ?? Object.values(j)[0];
    if (k) return k as string;
  } catch { /* sem chaves novas */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

// A chave só serve para instanciar o SDK; a verificação usa o segredo do webhook.
const stripe = new Stripe(Deno.env.get("STRIPE_INCOMUM_KEY") ?? "sk_unused", { httpClient: Stripe.createFetchHttpClient() });
const cripto = Stripe.createSubtleCryptoProvider();
const admin = createClient(Deno.env.get("SUPABASE_URL")!, chaveServidor());
const ok = (extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ recebido: true, ...extra }), { headers: { "Content-Type": "application/json" } });

function morada(s: Stripe.Checkout.Session) {
  // deno-lint-ignore no-explicit-any
  const x = s as any;
  const env = x.collected_information?.shipping_details ?? x.shipping_details ?? null;
  const a = env?.address ?? s.customer_details?.address ?? null;
  if (!a) return null;
  return {
    nome: env?.name ?? s.customer_details?.name ?? null,
    linha1: a.line1, linha2: a.line2, codigo_postal: a.postal_code, cidade: a.city, pais: a.country,
  };
}

const SITE = "https://theoddwork.com/incomum/";
const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// Conta do cliente: só o servidor cria contas (as inscrições livres estão desligadas no Auth da Oddwork).
async function criarConta(email: string, nome: string | null) {
  const { error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { loja: "incomum", nome } });
  if (error && !/already|registered|exists/i.test(error.message)) console.error("conta", error.message);
}

async function fotos(): Promise<Record<string, string>> {
  try {
    const c = await (await fetch(SITE + "catalogo.json", { signal: AbortSignal.timeout(4000) })).json();
    const m: Record<string, string> = {};
    // deno-lint-ignore no-explicit-any
    for (const p of c.produtos as any[]) for (const v of p.variantes) m[v.id] = SITE + (v.img || p.imgs?.[0] || "");
    return m;
  } catch { return {}; }
}

// E-mail de confirmação com a identidade Incomum (degradê ameixa → rosa → magenta, Montserrat, preto tinta).
// Construído em tabelas e estilos inline para abrir bem no Gmail, Outlook e Apple Mail (telemóvel incluído).
const MAPA = "https://www.google.com/maps/dir/?api=1&destination=Av.+Dr.+Louren%C3%A7o+Peixinho+10+3800-159+Aveiro";
const GRAD = "background-color:#cd507a;background-image:linear-gradient(120deg,#92497b 0%,#cd507a 55%,#f13f7b 100%)";
const FONTE = "font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif";
// deno-lint-ignore no-explicit-any
function emailHTML(e: any, f: Record<string, string>) {
  const link = SITE + "conta.html?t=" + e.token;
  const primeiro = esc(String(e.nome ?? "").split(" ")[0]);
  const m = e.morada ?? {};
  const quando = new Date(e.pago_em ?? Date.now()).toLocaleDateString("pt-PT", { day: "numeric", month: "long", timeZone: "Europe/Lisbon" });
  const npecas = (e.itens as { qtd: number }[]).reduce((a, i) => a + i.qtd, 0);
  // deno-lint-ignore no-explicit-any
  const pecas = (e.itens as any[]).map((i) => `
    <tr><td style="padding:0 0 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #efe9ec;border-radius:16px">
        <tr>
          <td width="96" valign="top" style="padding:12px 0 12px 12px">${f[i.variante_id]
            ? `<img src="${f[i.variante_id]}" width="84" height="104" alt="${esc(i.produto)}" style="display:block;width:84px;height:104px;object-fit:cover;border-radius:12px;background:#f6f4f5">`
            : `<div style="width:84px;height:104px;border-radius:12px;${GRAD}"></div>`}</td>
          <td valign="middle" style="padding:12px 14px;${FONTE}">
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#0d141a;line-height:1.3">${esc(i.produto)}</p>
            <p style="margin:0;font-size:13px;color:#6c7278;line-height:1.5">${esc(i.cor ?? "")}</p>
            <p style="margin:8px 0 0">${i.tam ? `<span style="display:inline-block;border:1px solid #e3dde0;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;color:#2b3238">Tam. ${esc(i.tam)}</span> ` : ""}<span style="display:inline-block;font-size:12px;color:#6c7278;padding:3px 4px">× ${i.qtd}</span></p>
          </td>
          <td valign="middle" align="right" style="padding:12px 16px 12px 0;${FONTE};font-size:15px;font-weight:700;color:#0d141a;white-space:nowrap">${eur(i.preco * i.qtd)}</td>
        </tr>
      </table>
    </td></tr>`).join("");
  const passo = (n: string, feito: boolean) => `
    <td width="25%" align="center" valign="top" style="${FONTE}">
      <div style="width:30px;height:30px;line-height:30px;border-radius:50%;margin:0 auto 8px;font-size:15px;font-weight:700;text-align:center;${feito ? GRAD + ";color:#ffffff" : "background:#ffffff;border:2px solid #e3dde0;width:26px;height:26px;line-height:26px;color:#c9c2c6"}">${feito ? "&#10003;" : "&bull;"}</div>
      <p style="margin:0;font-size:11.5px;font-weight:${feito ? 700 : 600};color:${feito ? "#0d141a" : "#8a8f94"};line-height:1.3">${n}</p>
    </td>`;
  return `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>A tua encomenda n.º ${e.numero} · Incomum.eu</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @media (max-width:520px){ .px{padding-left:20px!important;padding-right:20px!important} .h1{font-size:28px!important} .col{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important} .col+.col{padding-top:18px!important} }
  a{text-decoration:none}
</style></head>
<body style="margin:0;padding:0;background:#f3eff1">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Pagamento confirmado. Vamos preparar ${npecas > 1 ? "as tuas " + npecas + " peças" : "a tua peça"} em Aveiro.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3eff1"><tr><td align="center" style="padding:24px 10px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

  <!-- barra -->
  <tr><td align="center" style="background:#0d141a;border-radius:20px 20px 0 0;padding:11px 16px;${FONTE};font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:#e9e6e8">Revendedor autorizado LIVE! &nbsp;·&nbsp; Aveiro</td></tr>

  <!-- logótipo -->
  <tr><td align="center" style="background:#ffffff;padding:26px 24px 22px"><a href="${SITE}"><img src="${SITE}logo.jpg" width="168" alt="Incomum.eu" style="display:block;width:168px;height:auto;border:0"></a></td></tr>

  <!-- destaque -->
  <tr><td class="px" style="${GRAD};padding:40px 40px 38px;${FONTE}">
    <p style="margin:0 0 14px"><span style="display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:6px 14px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#ffffff">Encomenda n.º ${e.numero}</span></p>
    <h1 class="h1" style="margin:0 0 12px;font-size:34px;line-height:1.12;font-weight:800;letter-spacing:-.01em;color:#ffffff">${primeiro ? primeiro + ", já" : "Já"} é tua.<br>Nada comum.</h1>
    <p style="margin:0;font-size:15.5px;line-height:1.6;color:#ffffff;opacity:.92">O pagamento ficou confirmado a ${quando}. A partir de agora, a equipa da loja em Aveiro trata de tudo: separa cada peça, embala com cuidado e envia para a tua casa.</p>
  </td></tr>

  <!-- estado -->
  <tr><td class="px" style="background:#ffffff;padding:30px 32px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${passo("Paga", true)}${passo("Em preparação", false)}${passo("Enviada", false)}${passo("Entregue", false)}
    </tr></table>
  </td></tr>
  <tr><td class="px" align="center" style="background:#ffffff;padding:24px 32px 34px">
    <a href="${link}" style="display:inline-block;background:#0d141a;color:#ffffff;${FONTE};font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase;padding:17px 34px;border-radius:999px">Acompanhar a minha encomenda</a>
    <p style="margin:14px 0 0;${FONTE};font-size:12.5px;color:#8a8f94;line-height:1.5">Avisamos-te nessa página sempre que a encomenda avançar.</p>
  </td></tr>

  <!-- peças -->
  <tr><td class="px" style="background:#faf7f8;padding:30px 32px 16px;${FONTE}">
    <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#cd507a">${npecas > 1 ? "As tuas " + npecas + " peças" : "A tua peça"}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${pecas}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;${FONTE}">
      <tr><td style="padding:5px 2px;font-size:14px;color:#6c7278">Subtotal</td><td align="right" style="padding:5px 2px;font-size:14px;color:#2b3238">${eur(e.subtotal)}</td></tr>
      ${e.desconto > 0 ? `<tr><td style="padding:5px 2px;font-size:13px;font-weight:700;color:#cd507a">Inclui ${esc(e.campanha || "desconto")} −${e.desconto_pct}%</td><td align="right" style="padding:5px 2px;font-size:13px;font-weight:700;color:#cd507a">poupaste ${eur(e.desconto)}</td></tr>` : ""}
      <tr><td style="padding:5px 2px;font-size:14px;color:#6c7278">Envio Portugal continental</td><td align="right" style="padding:5px 2px;font-size:14px;color:#2b3238">${eur(e.portes)}</td></tr>
      <tr><td style="padding:14px 2px 4px;border-top:1px solid #e9e3e6;font-size:17px;font-weight:800;color:#0d141a">Total pago</td><td align="right" style="padding:14px 2px 4px;border-top:1px solid #e9e3e6;font-size:17px;font-weight:800;color:#0d141a">${eur(e.total)}</td></tr>
      <tr><td colspan="2" style="padding:0 2px 14px;font-size:11.5px;color:#8a8f94">IVA incluído</td></tr>
    </table>
  </td></tr>

  <!-- entrega -->
  <tr><td class="px" style="background:#ffffff;padding:28px 32px;${FONTE}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="col" width="50%" valign="top" style="padding-right:10px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8a8f94">Enviamos para</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#0d141a">${m.linha1 ? `<b>${esc(m.nome ?? e.nome)}</b><br>${esc(m.linha1)}${m.linha2 ? ", " + esc(m.linha2) : ""}<br>${esc(m.codigo_postal)} ${esc(m.cidade)}` : "A morada que indicaste no pagamento."}</p>
      </td>
      <td class="col" width="50%" valign="top" style="padding-left:10px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8a8f94">Entrega</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#0d141a"><b>Até 7 dias úteis</b><br>Portugal continental<br><span style="color:#6c7278">14 dias para devolver depois de receberes.</span></p>
      </td>
    </tr></table>
  </td></tr>

  <!-- loja -->
  <tr><td class="px" style="background:#0d141a;padding:32px 32px 30px;${FONTE}">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#f13f7b">Experimenta antes</p>
    <p style="margin:0 0 10px;font-size:21px;font-weight:800;line-height:1.25;color:#ffffff">A loja Incomum em Aveiro</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#c9c5c8">Na Galeria Centro Avenida, em frente ao Fórum. Toda a coleção LIVE! para experimentar, com ajuda para encontrar o tamanho certo.<br>Av. Dr. Lourenço Peixinho, 10, loja 23 · 3800-159 Aveiro</p>
    <a href="${MAPA}" style="display:inline-block;border:1.5px solid #ffffff;color:#ffffff;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:12px 22px;border-radius:999px">Como chegar</a>
  </td></tr>

  <!-- ajuda -->
  <tr><td class="px" align="center" style="background:#ffffff;border-radius:0 0 20px 20px;padding:26px 32px;${FONTE}">
    <p style="margin:0;font-size:13.5px;line-height:1.6;color:#2b3238">Alguma dúvida? Responde a este e-mail ou fala connosco no <a href="https://wa.me/351910202105?text=${encodeURIComponent(`Olá Incomum! Tenho uma dúvida sobre a minha encomenda n.º ${e.numero}.`)}" style="color:#92497b;font-weight:700">WhatsApp</a>.</p>
  </td></tr>

  <!-- rodapé -->
  <tr><td align="center" style="padding:20px 18px 0;${FONTE};font-size:11px;line-height:1.7;color:#8a8f94">
    Incomum.eu · Revendedor autorizado LIVE! em Portugal<br>
    Venda online feita por Oddwork · Rubens Bayard de Mello Silveiro · NIF 320510832 · Porto<br>
    <a href="${SITE}termos.html" style="color:#8a8f94;text-decoration:underline">Termos de venda</a> &nbsp;·&nbsp; <a href="${SITE}privacidade.html" style="color:#8a8f94;text-decoration:underline">Privacidade</a> &nbsp;·&nbsp; <a href="https://www.livroreclamacoes.pt/Inicio/" style="color:#8a8f94;text-decoration:underline">Livro de Reclamações</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// Envia uma vez por encomenda: reserva a coluna email_enviado antes de enviar (evita duplicados se o Stripe repetir).
async function enviarConfirmacao(id: string) {
  const user = Deno.env.get("INCOMUM_SMTP_USER"), pass = Deno.env.get("INCOMUM_SMTP_PASS");
  if (!user || !pass) { console.warn("email: faltam INCOMUM_SMTP_USER/INCOMUM_SMTP_PASS"); return; }
  const { data: e } = await admin.from("incomum_encomendas")
    .update({ email_enviado: new Date().toISOString() })
    .eq("id", id).is("email_enviado", null).in("estado", ["paga", "preparacao", "enviada", "entregue"])
    .select("*, itens:incomum_itens(*)").maybeSingle();
  if (!e?.email) return;
  try {
    const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    await t.sendMail({
      from: { name: "Incomum.eu", address: user },
      replyTo: user,
      to: e.email,
      subject: `Já é tua: encomenda n.º ${e.numero} confirmada · Incomum.eu`,
      text: `Obrigado! Recebemos a tua encomenda n.º ${e.numero} (${eur(e.total)}). Acompanha-a aqui: ${SITE}conta.html?t=${e.token}`,
      html: emailHTML(e, await fotos()),
    });
  } catch (err) {
    console.error("email", err);
    await admin.from("incomum_encomendas").update({ email_enviado: null }).eq("id", id);
  }
}

Deno.serve(async (req) => {
  const assinatura = req.headers.get("Stripe-Signature");
  if (!assinatura) return new Response("Sem assinatura", { status: 400 });
  const texto = await req.text();
  let ev: Stripe.Event;
  try {
    ev = await stripe.webhooks.constructEventAsync(texto, assinatura, Deno.env.get("STRIPE_INCOMUM_WEBHOOK")!, undefined, cripto);
  } catch {
    return new Response("Assinatura inválida", { status: 400 });
  }

  if (!ev.type.startsWith("checkout.session.")) return ok({ ignorado: true });
  const s = ev.data.object as Stripe.Checkout.Session;
  const id = s.metadata?.encomenda_id;
  if (s.metadata?.loja !== "incomum" || !id) return ok({ ignorado: true }); // cobranças da Oddwork ou de outros

  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
  const cliente = typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;
  const dados = {
    email: s.customer_details?.email ?? null,
    nome: s.customer_details?.name ?? null,
    telefone: s.customer_details?.phone ?? null,
  };

  switch (ev.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (s.payment_status === "paid" || s.payment_status === "no_payment_required") {
        const { error } = await admin.rpc("incomum_marcar_paga", {
          p_encomenda: id, p_pi: pi, p_cliente: cliente,
          p_email: dados.email, p_nome: dados.nome, p_telefone: dados.telefone, p_morada: morada(s),
        });
        if (error) { console.error("marcar_paga", error); return new Response("Erro", { status: 500 }); } // o Stripe volta a tentar
        if (dados.email) await criarConta(dados.email.trim().toLowerCase(), dados.nome);
        await enviarConfirmacao(id);
      } else {
        // Pagamento ainda a confirmar (ex.: métodos diferidos): guarda contacto e morada, fica pendente.
        await admin.from("incomum_encomendas").update({ ...dados, morada: morada(s), stripe_pi: pi, stripe_cliente: cliente })
          .eq("id", id).eq("estado", "pendente");
      }
      break;
    }
    case "checkout.session.async_payment_failed":
      await admin.from("incomum_encomendas").update({ estado: "falhou" }).eq("id", id).eq("estado", "pendente");
      break;
    case "checkout.session.expired":
      await admin.from("incomum_encomendas").update({ estado: "expirada" }).eq("id", id).eq("estado", "pendente");
      break;
  }
  return ok();
});
