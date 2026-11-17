// Ligação ao Supabase. A chave "publishable" é pública por natureza:
// só permite o que as regras da base de dados deixam (o site só consegue inserir).
window.ODDWORK = {
  supabaseUrl: "https://ydikcvrdpziwtgjabhnx.supabase.co",
  supabaseChave: "sb_publishable_rvZ6gfqLDjxiCOJSiIJIkg_Vo-W5U5T",

  // WhatsApp da Oddwork (só dígitos, com indicativo). Usado nos botões wa.me da LP.
  whatsapp: "351937298166",

  // Anúncios e estatísticas: vazio = não carrega nada. Preencher quando as contas existirem.
  metaPixel: "",        // ex.: "123456789012345"
  ga4: "",              // ex.: "G-XXXXXXXXXX"
  googleAds: "",        // ex.: "AW-123456789"
  googleAdsLead: "",    // rótulo da conversão de lead no Google Ads

  // Link do calendário (Cal.com ou Calendly) para /diagnostico/obrigado/. Vazio = esconde.
  calendario: "",
};
