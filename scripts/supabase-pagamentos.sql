-- Oddwork · pagamentos (Stripe). Só as funções do servidor escrevem; a equipa lê.
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  criado timestamptz not null default now(),
  atualizado timestamptz not null default now(),
  pedido_id uuid references public.pedidos(id) on delete set null,
  tipo text not null check (tipo in ('implantacao-1', 'implantacao-2', 'mensalidade', 'renovacao', 'outro')),
  descricao text,
  moeda text not null check (moeda in ('eur', 'brl')),
  valor integer not null check (valor >= 0), -- em cêntimos
  estado text not null default 'link_criado'
    check (estado in ('link_criado', 'pendente', 'pago', 'falhou', 'expirado', 'reembolsado', 'disputa', 'cancelado')),
  url text,
  stripe_sessao text unique,
  stripe_ref text,
  stripe_cliente text
);
create index if not exists pagamentos_pedido on public.pagamentos (pedido_id);
alter table public.pagamentos enable row level security;
revoke all on public.pagamentos from anon, authenticated;
grant select on public.pagamentos to authenticated;

drop policy if exists "equipa le pagamentos" on public.pagamentos;
create policy "equipa le pagamentos" on public.pagamentos
  for select to authenticated using (public.e_equipa());

-- O cliente Stripe de cada pedido (para não duplicar clientes).
alter table public.pedidos add column if not exists stripe_cliente text;

-- As funções do servidor (cobrar, stripe-webhook) usam o papel service_role.
-- Neste projeto as tabelas não ficam expostas automaticamente, por isso damos o acesso à mão.
grant select, update on public.pedidos to service_role;
grant select, insert, update on public.pagamentos to service_role;
