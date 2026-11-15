-- Oddwork · base de dados do site (Supabase)
-- Pedidos de diagnóstico, eventos de visita e equipa com acesso ao painel.
-- O site (anónimo) só pode INSERIR. Só a equipa autenticada pode LER e mudar o estado.

-- ---------- Equipa ----------
create table if not exists public.equipa (
  email text primary key check (email = lower(email))
);
alter table public.equipa enable row level security;
revoke all on public.equipa from anon, authenticated;

create or replace function public.e_equipa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.equipa
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.e_equipa() from public;
grant execute on function public.e_equipa() to authenticated;

-- ---------- Pedidos de diagnóstico ----------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  criado timestamptz not null default now(),
  nome text not null check (char_length(nome) between 1 and 120),
  negocio text not null check (char_length(negocio) between 1 and 160),
  tipo text check (char_length(tipo) <= 80),
  clientes text check (char_length(clientes) <= 40),
  dor text check (char_length(dor) <= 120),
  whatsapp text check (char_length(whatsapp) <= 40),
  email text check (char_length(email) <= 160),
  origem text check (char_length(origem) <= 80),
  pais text check (pais in ('Portugal', 'Brasil')),
  vid text check (char_length(vid) <= 64),
  estado text not null default 'novo'
    check (estado in ('novo', 'contactado', 'diagnostico', 'proposta', 'cliente', 'perdido')),
  notas text check (char_length(notas) <= 4000)
);
alter table public.pedidos enable row level security;
revoke all on public.pedidos from anon, authenticated;

-- O site só escreve estes campos (não consegue escolher o estado nem ler nada).
grant insert (nome, negocio, tipo, clientes, dor, whatsapp, email, origem, pais, vid)
  on public.pedidos to anon, authenticated;
grant select, update (estado, notas) on public.pedidos to authenticated;

drop policy if exists "site insere pedidos" on public.pedidos;
create policy "site insere pedidos" on public.pedidos
  for insert to anon, authenticated with check (estado = 'novo');

drop policy if exists "equipa le pedidos" on public.pedidos;
create policy "equipa le pedidos" on public.pedidos
  for select to authenticated using (public.e_equipa());

drop policy if exists "equipa muda pedidos" on public.pedidos;
create policy "equipa muda pedidos" on public.pedidos
  for update to authenticated using (public.e_equipa()) with check (public.e_equipa());

-- ---------- Eventos de visita ----------
create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  t timestamptz not null default now(),
  tipo text not null check (tipo in
    ('visita-anonima', 'consentimento', 'sessao', 'pagina', 'secao', 'clique', 'pergunta', 'form-campo', 'pedido', 'saida')),
  vid text check (char_length(vid) <= 64),
  sid text check (char_length(sid) <= 64),
  pagina text check (char_length(pagina) <= 200),
  mercado text check (mercado in ('pt', 'br')),
  dados jsonb not null default '{}'::jsonb check (pg_column_size(dados) <= 3000)
);
create index if not exists eventos_t on public.eventos (t desc);
create index if not exists eventos_vid on public.eventos (vid) where vid is not null;
alter table public.eventos enable row level security;
revoke all on public.eventos from anon, authenticated;

grant insert (tipo, vid, sid, pagina, mercado, dados) on public.eventos to anon, authenticated;
grant select on public.eventos to authenticated;

-- Eventos anónimos não podem ter identificador.
drop policy if exists "site insere eventos" on public.eventos;
create policy "site insere eventos" on public.eventos
  for insert to anon, authenticated
  with check (tipo not in ('visita-anonima', 'consentimento') or (vid is null and sid is null));

drop policy if exists "equipa le eventos" on public.eventos;
create policy "equipa le eventos" on public.eventos
  for select to authenticated using (public.e_equipa());
