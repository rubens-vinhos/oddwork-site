-- Links curtos de pagamento: theoddwork.com/p/?CODIGO
-- Cada cobrança tem um código aleatório. A página /p/ pergunta à base de dados
-- para onde enviar a pessoa, e só recebe o link do Stripe se ainda estiver por pagar.

alter table public.pagamentos add column if not exists codigo text;
create unique index if not exists pagamentos_codigo_unico on public.pagamentos (codigo);

create or replace function public.link_pagamento(c text)
returns table (estado text, url text, valor integer, moeda text, tipo text)
language sql
stable
security definer
set search_path = public
as $$
  select p.estado,
         case when p.estado in ('link_criado', 'pendente') then p.url end,
         p.valor,
         p.moeda,
         p.tipo
  from public.pagamentos p
  where p.codigo = upper(trim(c)) and length(trim(c)) between 6 and 16
  limit 1;
$$;

revoke all on function public.link_pagamento(text) from public;
grant execute on function public.link_pagamento(text) to anon, authenticated;
