// Oddwork · recebe os avisos do Stripe e atualiza a tabela "pagamentos".
// Segredos: STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET (whsec_…). Sem verificação de JWT (o Stripe assina).
import Stripe from "npm:stripe@23.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Chave de servidor: as novas (SUPABASE_SECRET_KEYS) ou, se não houver, a antiga.
function chaveServidor(): string {
  try {
    const j = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const k = j.default ?? Object.values(j)[0];
    if (k) return k as string;
  } catch { /* sem chaves novas */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
function chavePublica(): string {
  try {
    const j = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const k = j.default ?? Object.values(j)[0];
    if (k) return k as string;
  } catch { /* sem chaves novas */ }
  return Deno.env.get("SUPABASE_ANON_KEY")!;
}

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { httpClient: Stripe.createFetchHttpClient() });
const cripto = Stripe.createSubtleCryptoProvider();
const admin = createClient(Deno.env.get("SUPABASE_URL")!, chaveServidor());

async function mudar(sessao: string, campos: Record<string, unknown>) {
  const { error } = await admin.from("pagamentos").update({ ...campos, atualizado: new Date().toISOString() }).eq("stripe_sessao", sessao);
  if (error) console.error("mudar", error);
}
async function pedidoDoCliente(cliente: string | null) {
  if (!cliente) return null;
  const { data } = await admin.from("pedidos").select("id").eq("stripe_cliente", cliente).maybeSingle();
  return data?.id ?? null;
}
async function marcarCliente(pedidoId: string | null) {
  if (pedidoId) await admin.from("pedidos").update({ estado: "cliente" }).eq("id", pedidoId).neq("estado", "cliente");
}

Deno.serve(async (req) => {
  const assinatura = req.headers.get("Stripe-Signature");
  if (!assinatura) return new Response("Sem assinatura", { status: 400 });
  const texto = await req.text();
  let ev: Stripe.Event;
  try {
    ev = await stripe.webhooks.constructEventAsync(texto, assinatura, Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, cripto);
  } catch {
    return new Response("Assinatura inválida", { status: 400 });
  }

  switch (ev.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = ev.data.object as Stripe.Checkout.Session;
      const pago = s.payment_status === "paid" || s.payment_status === "no_payment_required";
      const ref = (typeof s.subscription === "string" ? s.subscription : s.subscription?.id) ??
        (typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id) ?? null;
      await mudar(s.id, { estado: pago ? "pago" : "pendente", stripe_ref: ref });
      if (pago) await marcarCliente(s.metadata?.pedido_id ?? null);
      break;
    }
    case "checkout.session.async_payment_failed":
      await mudar((ev.data.object as Stripe.Checkout.Session).id, { estado: "falhou" });
      break;
    case "checkout.session.expired":
      await mudar((ev.data.object as Stripe.Checkout.Session).id, { estado: "expirado" });
      break;

    // Mensalidades seguintes (a primeira já fica registada pela sessão)
    case "invoice.paid":
    case "invoice.payment_failed": {
      const f = ev.data.object as Stripe.Invoice;
      if (f.billing_reason !== "subscription_cycle") break;
      const cliente = typeof f.customer === "string" ? f.customer : f.customer?.id ?? null;
      await admin.from("pagamentos").upsert({
        pedido_id: await pedidoDoCliente(cliente),
        tipo: "renovacao",
        descricao: "Mensalidade (renovação)",
        moeda: f.currency,
        valor: ev.type === "invoice.paid" ? f.amount_paid : f.amount_due,
        estado: ev.type === "invoice.paid" ? "pago" : "falhou",
        stripe_sessao: f.id, // a fatura serve de identificador único
        stripe_ref: f.id,
        stripe_cliente: cliente,
        url: f.hosted_invoice_url,
        atualizado: new Date().toISOString(),
      }, { onConflict: "stripe_sessao" });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = ev.data.object as Stripe.Subscription;
      await admin.from("pagamentos").update({ estado: "cancelado", atualizado: new Date().toISOString() })
        .eq("stripe_ref", sub.id).eq("tipo", "mensalidade");
      break;
    }

    // Reembolsos e disputas: marca o pagamento original
    case "charge.refunded":
    case "charge.dispute.created": {
      const obj = ev.data.object as Stripe.Charge | Stripe.Dispute;
      const pi = typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id;
      if (pi) {
        await admin.from("pagamentos").update({ estado: ev.type === "charge.refunded" ? "reembolsado" : "disputa", atualizado: new Date().toISOString() })
          .eq("stripe_ref", pi);
      }
      break;
    }
  }
  return new Response(JSON.stringify({ recebido: true }), { headers: { "Content-Type": "application/json" } });
});
