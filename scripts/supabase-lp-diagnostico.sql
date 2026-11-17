-- Landing page /diagnostico: formulário em 2 passos.
-- Passo 1 grava o lead (nome, WhatsApp, tipo + origem do anúncio).
-- Passo 2 completa o mesmo pedido através de uma função que só mexe em pedidos acabados de criar.
-- Pode correr-se mais de uma vez.

-- O passo 1 ainda não tem o nome do negócio.
alter table public.pedidos alter column negocio drop not null;

alter table public.pedidos add column if not exists passo smallint not null default 2 check (passo in (1, 2));
alter table public.pedidos add column if not exists site text check (char_length(site) <= 200);
alter table public.pedidos add column if not exists horas_calc integer check (horas_calc between 0 and 2000);
alter table public.pedidos add column if not exists pagina text check (char_length(pagina) <= 200);
alter table public.pedidos add column if not exists utm_source text check (char_length(utm_source) <= 120);
alter table public.pedidos add column if not exists utm_medium text check (char_length(utm_medium) <= 120);
alter table public.pedidos add column if not exists utm_campaign text check (char_length(utm_campaign) <= 120);
alter table public.pedidos add column if not exists utm_content text check (char_length(utm_content) <= 120);
alter table public.pedidos add column if not exists clid text check (char_length(clid) <= 300);

-- O site continua só a inserir; agora também pode escolher o id (para o passo 2) e os campos novos.
grant insert (id, nome, negocio, tipo, clientes, dor, whatsapp, email, origem, pais, vid,
              passo, site, horas_calc, pagina, utm_source, utm_medium, utm_campaign, utm_content, clid)
  on public.pedidos to anon, authenticated;

-- Passo 2: completa um pedido do passo 1 criado há menos de 2 horas. Não devolve dados.
create or replace function public.completar_pedido(
  p_id uuid, p_negocio text, p_clientes text, p_dor text, p_site text
) returns void
language sql security definer set search_path = public as $$
  update public.pedidos
     set negocio  = nullif(left(trim(p_negocio), 160), ''),
         clientes = nullif(left(trim(p_clientes), 40), ''),
         dor      = nullif(left(trim(p_dor), 120), ''),
         site     = nullif(left(trim(p_site), 200), ''),
         passo    = 2
   where id = p_id and passo = 1 and criado > now() - interval '2 hours';
$$;
revoke all on function public.completar_pedido(uuid, text, text, text, text) from public;
grant execute on function public.completar_pedido(uuid, text, text, text, text) to anon, authenticated;
