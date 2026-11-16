-- Incomum.eu · fase 5: campanha com desconto por número de peças (ex.: Black Friday).
-- O desconto é calculado no servidor (função incomum-checkout); a loja só o mostra.
create table if not exists public.incomum_campanha (
  id integer primary key default 1 check (id = 1),
  ativa boolean not null default false,
  nome text not null default 'Black Friday',
  fim timestamptz not null,
  escaloes jsonb not null default '[]'::jsonb,   -- [{ "pecas": 1, "pct": 20 }, ...] por ordem crescente
  atualizado timestamptz not null default now(),
  constraint escaloes_validos check (jsonb_typeof(escaloes) = 'array')
);
alter table public.incomum_campanha enable row level security;
grant select on public.incomum_campanha to anon, authenticated;
grant update (ativa, nome, fim, escaloes, atualizado) on public.incomum_campanha to authenticated;
grant select, insert, update, delete on public.incomum_campanha to service_role;
drop policy if exists "campanha publica" on public.incomum_campanha;
create policy "campanha publica" on public.incomum_campanha for select to anon, authenticated using (true);
drop policy if exists "equipa muda campanha" on public.incomum_campanha;
create policy "equipa muda campanha" on public.incomum_campanha for update to authenticated
  using (public.incomum_e_equipa()) with check (public.incomum_e_equipa());

insert into public.incomum_campanha (id, ativa, nome, fim, escaloes)
values (1, true, 'Black Friday', '2026-11-22 23:59:59 Europe/Lisbon',
        '[{"pecas":1,"pct":20},{"pecas":2,"pct":25},{"pecas":3,"pct":30}]')
on conflict (id) do nothing;

-- Quanto se poupou em cada encomenda (cêntimos) e com que campanha.
alter table public.incomum_encomendas
  add column if not exists desconto integer not null default 0 check (desconto >= 0),
  add column if not exists desconto_pct integer check (desconto_pct between 1 and 90),
  add column if not exists campanha text;
grant select, insert, update on public.incomum_encomendas to service_role;

select * from public.incomum_campanha;

-- Mostrar o desconto na página de obrigado e no link de acompanhamento.
create or replace function public.incomum_estado_encomenda(sessao text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', e.numero, 'estado', e.estado,
    'subtotal', e.subtotal, 'portes', e.portes, 'total', e.total,
    'desconto', e.desconto, 'desconto_pct', e.desconto_pct, 'campanha', e.campanha,
    'email', e.email,
    'token', case when e.estado in ('paga', 'preparacao', 'enviada', 'entregue') then e.token end,
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'variante', i.variante_id, 'produto', i.produto, 'cor', i.cor, 'tam', i.tam, 'qtd', i.qtd, 'preco', i.preco) order by i.id)
      from public.incomum_itens i where i.encomenda_id = e.id), '[]'::jsonb))
  from public.incomum_encomendas e
  where e.stripe_sessao = sessao and sessao like 'cs\_%'
  limit 1;
$$;
revoke all on function public.incomum_estado_encomenda(text) from public;
grant execute on function public.incomum_estado_encomenda(text) to anon, authenticated, service_role;

create or replace function public.incomum_acompanhar(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', e.numero, 'estado', e.estado, 'nome', split_part(coalesce(e.nome, ''), ' ', 1),
    'cidade', e.morada ->> 'cidade',
    'criado', e.criado, 'pago_em', e.pago_em, 'preparacao_em', e.preparacao_em,
    'enviado_em', e.enviado_em, 'entregue_em', e.entregue_em,
    'transportadora', e.transportadora, 'seguimento', e.seguimento,
    'subtotal', e.subtotal, 'portes', e.portes, 'total', e.total,
    'desconto', e.desconto, 'desconto_pct', e.desconto_pct, 'campanha', e.campanha,
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'variante', i.variante_id, 'produto', i.produto, 'cor', i.cor, 'tam', i.tam, 'qtd', i.qtd, 'preco', i.preco) order by i.id)
      from public.incomum_itens i where i.encomenda_id = e.id), '[]'::jsonb))
  from public.incomum_encomendas e
  where length(p_token) = 64 and e.token = p_token
    and e.estado in ('paga', 'preparacao', 'enviada', 'entregue', 'cancelada')
  limit 1;
$$;
revoke all on function public.incomum_acompanhar(text) from public;
grant execute on function public.incomum_acompanhar(text) to anon, authenticated;
