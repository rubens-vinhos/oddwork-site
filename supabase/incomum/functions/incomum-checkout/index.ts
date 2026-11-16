// Incomum.eu · cria a encomenda e o pagamento (Stripe Checkout).
// Público (a loja chama sem sessão). Os preços e o stock são SEMPRE lidos da base de dados, nunca do browser.
// Segredo: STRIPE_INCOMUM_KEY (chave restrita "Incomum loja"). Não usa as chaves da Oddwork.
import Stripe from "npm:stripe@23.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

function chaveServidor(): string {
  try {
    const j = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const k = j.default ?? Object.values(j)[0];
    if (k) return k as string;
  } catch { /* sem chaves novas */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

const SITE = "https://theoddwork.com/incomum/";
const ORIGENS = ["https://theoddwork.com", "http://localhost:5191"];
// ---- Envio (fácil de mudar) ----
const PORTES = 1000;            // cêntimos: 10 € fixos em todas as encomendas
const ENVIO_NOME = "Envio Portugal continental";
const PRAZO_MAX_DIAS = 7;       // dias úteis
const MAX_LINHAS = 20, MAX_QTD = 10;

function cors(origem: string | null) {
  return {
    "Access-Control-Allow-Origin": origem && ORIGENS.includes(origem) ? origem : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
const resposta = (corpo: unknown, estado: number, h: Record<string, string>) =>
  new Response(JSON.stringify(corpo), { status: estado, headers: { ...h, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const origem = req.headers.get("Origin");
  const h = cors(origem);
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido" }, 405, h);
  const voltar = origem === "http://localhost:5191" ? "http://localhost:5191/" : SITE;

  // 1. Carrinho: só ids de variante e quantidades.
  let corpo: { itens?: { variante?: unknown; qtd?: unknown }[]; modo?: unknown };
  try { corpo = await req.json(); } catch { return resposta({ erro: "Pedido inválido" }, 400, h); }
  const qtdPor = new Map<string, number>();
  for (const i of corpo.itens ?? []) {
    const id = typeof i?.variante === "string" ? i.variante : "";
    const q = Number(i?.qtd);
    if (!/^[\w-]{3,80}$/.test(id) || !Number.isInteger(q) || q < 1 || q > MAX_QTD) {
      return resposta({ erro: "O saco tem uma linha inválida. Atualiza a página." }, 400, h);
    }
    qtdPor.set(id, Math.min(MAX_QTD, (qtdPor.get(id) ?? 0) + q));
  }
  if (!qtdPor.size || qtdPor.size > MAX_LINHAS) return resposta({ erro: "O saco está vazio." }, 400, h);

  // 2. Preço e stock vêm da base de dados.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, chaveServidor());
  const { data: vars, error } = await admin
    .from("incomum_variantes")
    .select("id, cor, tam, preco, promo, stock, ativo, produto:incomum_produtos!inner(nome, ativo)")
    .in("id", [...qtdPor.keys()]);
  if (error) { console.error("variantes", error); return resposta({ erro: "Não foi possível confirmar o stock. Tenta de novo." }, 500, h); }

  const linhas = [];
  const esgotados: string[] = [];
  for (const [id, qtd] of qtdPor) {
    const v = vars?.find((x) => x.id === id);
    // deno-lint-ignore no-explicit-any
    const prod = v?.produto as any;
    if (!v || !v.ativo || !prod?.ativo) { esgotados.push("uma peça que já não está à venda"); continue; }
    const desc = [v.cor, v.tam && "Tam. " + v.tam].filter(Boolean).join(" · ");
    if (v.stock < qtd) { esgotados.push(`${prod.nome}${desc ? " (" + desc + ")" : ""}${v.stock ? `: só há ${v.stock}` : ": esgotado"}`); continue; }
    const preco = v.promo && v.promo < v.preco ? v.promo : v.preco;
    linhas.push({ id, qtd, preco, nome: prod.nome as string, cor: v.cor, tam: v.tam, desc });
  }
  if (esgotados.length) return resposta({ erro: "Sem stock suficiente: " + esgotados.join("; ") + ".", esgotados }, 409, h);

  const subtotal = linhas.reduce((a, l) => a + l.preco * l.qtd, 0);
  const portes = PORTES;

  // 3. Encomenda pendente (o webhook passa-a a paga e baixa o stock).
  const { data: enc, error: e1 } = await admin.from("incomum_encomendas")
    .insert({ subtotal, portes, total: subtotal + portes }).select("id, numero").single();
  if (e1 || !enc) { console.error("encomenda", e1); return resposta({ erro: "Não foi possível criar a encomenda." }, 500, h); }
  const { error: e2 } = await admin.from("incomum_itens").insert(linhas.map((l) => ({
    encomenda_id: enc.id, variante_id: l.id, produto: l.nome, cor: l.cor, tam: l.tam, qtd: l.qtd, preco: l.preco,
  })));
  if (e2) { console.error("itens", e2); await admin.from("incomum_encomendas").delete().eq("id", enc.id); return resposta({ erro: "Não foi possível criar a encomenda." }, 500, h); }

  // 4. Sessão Stripe. Metadata "loja: incomum" separa estas vendas das cobranças da Oddwork.
  //    Nunca usar a chave "pedido_id" (o webhook da Oddwork reage a ela).
  const metadata = { loja: "incomum", encomenda_id: enc.id, encomenda: String(enc.numero) };
  const stripe = new Stripe(Deno.env.get("STRIPE_INCOMUM_KEY")!, { httpClient: Stripe.createFetchHttpClient() });
  // "embedded": o pagamento abre dentro da página checkout.html da loja. Sem modo: página do Stripe (reserva).
  const embutido = corpo.modo === "embedded";
  const regresso = embutido
    ? { ui_mode: "embedded_page", return_url: voltar + "obrigado.html?s={CHECKOUT_SESSION_ID}" }
    : { success_url: voltar + "obrigado.html?s={CHECKOUT_SESSION_ID}", cancel_url: voltar + "#saco" };
  try {
    const sessao = await stripe.checkout.sessions.create({
      ...regresso,
      mode: "payment",
      locale: "pt",
      line_items: linhas.map((l) => ({
        quantity: l.qtd,
        price_data: {
          currency: "eur",
          unit_amount: l.preco,
          tax_behavior: "inclusive",
          product_data: { name: "Incomum · " + l.nome, ...(l.desc ? { description: l.desc } : {}), metadata: { loja: "incomum", variante: l.id } },
        },
      })),
      shipping_address_collection: { allowed_countries: ["PT"] },
      phone_number_collection: { enabled: true },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: ENVIO_NOME,
          fixed_amount: { amount: portes, currency: "eur" },
          tax_behavior: "inclusive",
          delivery_estimate: { minimum: { unit: "business_day", value: 1 }, maximum: { unit: "business_day", value: PRAZO_MAX_DIAS } },
          metadata: { loja: "incomum" },
        },
      }],
      customer_creation: "always",
      billing_address_collection: "auto",
      metadata,
      payment_intent_data: { metadata, description: `Incomum · encomenda ${enc.numero}` },
      integration_identifier: "incomum_loja_wkpqhzrt",
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hora para pagar
      branding_settings: { font_family: "montserrat", button_color: "#0d141a", border_style: "rounded", background_color: "#ffffff" },
      custom_text: {
        shipping_address: { message: "Enviamos só para Portugal continental (não para os Açores nem a Madeira)." },
        submit: { message: "Venda feita por Oddwork (Rubens Bayard de Mello Silveiro, NIF 320510832). Ao pagar aceitas os termos de venda em theoddwork.com/incomum/termos.html." },
        after_submit: { message: `Logo a seguir ao pagamento recebes um e-mail de confirmação com o link para acompanhares a encomenda. Entrega em até ${PRAZO_MAX_DIAS} dias úteis.` },
      },
    } as Stripe.Checkout.SessionCreateParams);

    await admin.from("incomum_encomendas").update({ stripe_sessao: sessao.id }).eq("id", enc.id);
    return resposta(embutido ? { clientSecret: sessao.client_secret, encomenda: enc.numero } : { url: sessao.url, encomenda: enc.numero }, 200, h);
  } catch (e) {
    console.error("stripe", e);
    await admin.from("incomum_encomendas").update({ estado: "falhou", notas: "Erro ao criar o pagamento" }).eq("id", enc.id);
    return resposta({ erro: "O pagamento não abriu. Tenta de novo daqui a pouco." }, 502, h);
  }
});
