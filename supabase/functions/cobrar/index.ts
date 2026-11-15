// Oddwork · cria um link de pagamento (Stripe Checkout) para um pedido.
// Só a equipa (sessão Supabase + email na tabela "equipa") pode chamar.
// Segredos (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY (chave restrita rk_…).
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

const ORIGENS = ["https://theoddwork.com", "http://localhost:5183"];
const SITE = "https://theoddwork.com";

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

// O que cada tipo de cobrança usa no catálogo do Stripe (lookup_keys).
const PRODUTO: Record<string, Record<string, string>> = {
  fundador: { implantacao: "implantacao_fundador", mensalidade: "mensalidade_fundador" },
  normal: { implantacao: "implantacao_normal", mensalidade: "mensalidade_normal" },
};

// Catálogo: se o produto ou o preço ainda não existirem nesta conta Stripe (ex.: na conta real),
// são criados na primeira cobrança, com o mesmo lookup_key.
const CATALOGO: Record<string, { nome: string; mensal?: boolean; eur?: number; brl?: number }> = {
  implantacao_fundador: { nome: "Implantação · Fundador (metade)", eur: 45000, brl: 100000 },
  implantacao_normal: { nome: "Implantação (metade)", eur: 75000 },
  mensalidade_fundador: { nome: "Mensalidade · Fundador", mensal: true, eur: 10000, brl: 35000 },
  mensalidade_normal: { nome: "Mensalidade", mensal: true, eur: 13000 },
};

async function produtoCatalogo(stripe: Stripe, base: string): Promise<string> {
  for (const m of ["eur", "brl"]) {
    const r = await stripe.prices.list({ lookup_keys: [base + "_" + m], limit: 1 });
    if (r.data[0]) return r.data[0].product as string;
  }
  const s = await stripe.products.search({ query: "metadata['chave']:'" + base + "'" });
  if (s.data[0]) return s.data[0].id;
  const p = await stripe.products.create({ name: CATALOGO[base].nome, metadata: { chave: base } });
  return p.id;
}

async function precoCatalogo(stripe: Stripe, base: string, moeda: "eur" | "brl"): Promise<Stripe.Price | null> {
  const chave = base + "_" + moeda;
  const r = await stripe.prices.list({ lookup_keys: [chave], active: true });
  if (r.data[0]) return r.data[0];
  const c = CATALOGO[base];
  const valor = c?.[moeda];
  if (!valor) return null;
  return await stripe.prices.create({
    product: await produtoCatalogo(stripe, base),
    currency: moeda,
    unit_amount: valor,
    tax_behavior: "inclusive",
    lookup_key: chave,
    ...(c.mensal ? { recurring: { interval: "month" } } : {}),
  });
}

// No Pix o IOF fica incluído no preço: o cliente paga exatamente o valor do link (a Oddwork absorve o IOF).
const IOF_AVISO =
  "Compra internacional. No Pix, o IOF já está incluído no valor. Ao prosseguir, você reconhece e aceita os termos e condições do Ebanx.";

Deno.serve(async (req) => {
  const h = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido" }, 405, h);

  // 1. Quem está a pedir? Tem de ser da equipa.
  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const comoUtilizador = createClient(url, chavePublica(), { global: { headers: { Authorization: auth } } });
  const { data: eEquipa } = await comoUtilizador.rpc("e_equipa");
  if (!eEquipa) return resposta({ erro: "Sem acesso" }, 403, h);

  // 2. O que cobrar
  let corpo: { pedido_id?: string; tipo?: string; plano?: string; valor?: number; cancelar?: string };
  try { corpo = await req.json(); } catch { return resposta({ erro: "Pedido inválido" }, 400, h); }

  // Cancelar um link ainda por pagar. O Stripe avisa o webhook (checkout.session.expired),
  // e é o webhook que marca o pagamento como "Expirou" no painel.
  if (corpo.cancelar) {
    const adm = createClient(url, chaveServidor());
    const { data: pag } = await adm.from("pagamentos").select("id, estado, stripe_sessao").eq("id", corpo.cancelar).single();
    if (!pag?.stripe_sessao) return resposta({ erro: "Pagamento não encontrado" }, 404, h);
    if (!["link_criado", "pendente"].includes(pag.estado)) return resposta({ erro: "Este link já não está por pagar." }, 400, h);
    const st = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { httpClient: Stripe.createFetchHttpClient() });
    try {
      await st.checkout.sessions.expire(pag.stripe_sessao);
    } catch (e) {
      console.error("expirar", e);
      return resposta({ erro: "O Stripe não deixou cancelar este link." }, 400, h);
    }
    return resposta({ ok: true }, 200, h);
  }

  const { pedido_id, tipo, plano = "fundador", valor } = corpo;
  if (!pedido_id || !["implantacao-1", "implantacao-2", "mensalidade"].includes(tipo ?? "") || !PRODUTO[plano]) {
    return resposta({ erro: "Faltam dados: pedido, tipo e plano." }, 400, h);
  }

  const admin = createClient(url, chaveServidor());
  const { data: pedido, error: erroPedido } = await admin.from("pedidos").select("*").eq("id", pedido_id).single();
  if (erroPedido) console.error("pedido", erroPedido);
  if (erroPedido || !pedido) return resposta({ erro: "Pedido não encontrado" }, 404, h);

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { httpClient: Stripe.createFetchHttpClient() });
  const brasil = pedido.pais === "Brasil";
  const moeda = brasil ? "brl" : "eur";
  const mensal = tipo === "mensalidade";
  const base = PRODUTO[plano][mensal ? "mensalidade" : "implantacao"];

  // 3. Preço: do catálogo, ou valor à medida (preço normal no Brasil varia por proposta).
  let item: Stripe.Checkout.SessionCreateParams.LineItem;
  let valorCents: number;
  if (valor && Number.isInteger(valor) && valor > 0) {
    const produto = await produtoCatalogo(stripe, base);
    valorCents = valor;
    item = { quantity: 1, price_data: { currency: moeda, product: produto, unit_amount: valor, tax_behavior: "inclusive", ...(mensal ? { recurring: { interval: "month" } } : {}) } };
  } else {
    const preco = await precoCatalogo(stripe, base, moeda);
    if (!preco) return resposta({ erro: "Não há preço de " + plano + " em " + moeda.toUpperCase() + ". Indica o valor." }, 400, h);
    valorCents = preco.unit_amount ?? 0;
    item = { quantity: 1, price: preco.id };
  }

  // 4. Cliente Stripe (um por pedido)
  let cliente = pedido.stripe_cliente as string | null;
  // O cliente guardado pode ser de outra conta Stripe (ex.: do modo de teste). Nesse caso cria-se outro.
  if (cliente) {
    try {
      const c = await stripe.customers.retrieve(cliente);
      if ((c as Stripe.DeletedCustomer).deleted) cliente = null;
    } catch { cliente = null; }
  }
  if (!cliente) {
    const c = await stripe.customers.create({
      email: pedido.email ?? undefined,
      name: pedido.negocio,
      metadata: { pedido_id: pedido.id, contacto: pedido.nome },
      preferred_locales: [brasil ? "pt-BR" : "pt"],
    });
    cliente = c.id;
    await admin.from("pedidos").update({ stripe_cliente: cliente }).eq("id", pedido.id);
  }

  const nomes: Record<string, string> = { "implantacao-1": "Implantação (1.ª metade)", "implantacao-2": "Implantação (2.ª metade)", mensalidade: "Mensalidade" };
  const metadata = { pedido_id: pedido.id, tipo: tipo! };

  // 5. Sessão de pagamento
  const sessao = await stripe.checkout.sessions.create({
    mode: mensal ? "subscription" : "payment",
    customer: cliente,
    line_items: [item],
    locale: brasil ? "pt-BR" : "pt",
    success_url: SITE + "/obrigado.html?pagamento=ok&tipo=" + tipo,
    cancel_url: SITE + "/",
    metadata,
    integration_identifier: "painel_cobranca_qmzrtvxk",
    // Diz ao cliente, logo no checkout, que vai receber um e-mail a seguir ao pagamento.
    custom_text: {
      after_submit: { message: brasil ? "Logo depois do pagamento, você recebe um e-mail com o recibo." : "Logo a seguir ao pagamento, recebes um e-mail com o recibo." },
      ...(brasil ? { submit: { message: IOF_AVISO } } : {}),
    },
    ...(mensal ? { subscription_data: { metadata } } : { payment_intent_data: { metadata, description: nomes[tipo!] + " · " + pedido.negocio }, invoice_creation: { enabled: true } }),
    ...(brasil
      ? {
          payment_method_options: mensal
            ? // Pix Automático: em assinaturas o Stripe só aceita valor, periodicidade e IOF.
              { pix: { mandate_options: { amount: valorCents, amount_includes_iof: "always", payment_schedule: "monthly" } } }
            : { pix: { amount_includes_iof: "always" } },
        }
      : {}),
  } as Stripe.Checkout.SessionCreateParams);

  // Link curto (theoddwork.com/p/?CODIGO): 8 letras e números sem os que se confundem (0/O, 1/I/L).
  const novoCodigo = () => {
    const letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const r = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(r, (n) => letras[n % letras.length]).join("");
  };
  const linha = {
    pedido_id: pedido.id,
    tipo,
    descricao: nomes[tipo!] + " · " + (plano === "fundador" ? "Fundador" : "Normal"),
    moeda,
    valor: valorCents,
    estado: "link_criado",
    url: sessao.url,
    stripe_sessao: sessao.id,
    stripe_cliente: cliente,
  };
  let codigo: string | null = null;
  for (let i = 0; i < 3 && !codigo; i++) {
    const c = novoCodigo();
    const { error } = await admin.from("pagamentos").insert({ ...linha, codigo: c });
    if (!error) codigo = c;
    else if (error.code !== "23505") { console.error("pagamentos", error); break; } // 23505 = código repetido
  }
  if (!codigo) {
    const { error } = await admin.from("pagamentos").insert(linha);
    if (error) console.error("pagamentos", error);
  }

  return resposta({ url: sessao.url, curto: codigo ? SITE + "/p/?" + codigo : sessao.url, codigo }, 200, h);
});
