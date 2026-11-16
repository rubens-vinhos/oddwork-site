-- Incomum.eu · loja online (no projeto Supabase da Oddwork, tudo com prefixo incomum_)
-- Regras:
--   · o público só LÊ produtos e variantes ativos (preço e stock);
--   · as encomendas só são escritas pelas Edge Functions (chave de servidor, que ignora o RLS);
--   · a equipa da Incomum (tabela incomum_equipa) e a da Oddwork (public.e_equipa) leem e gerem tudo no painel.
-- Pode correr-se várias vezes sem estragar nada.

-- ---------- Equipa ----------
create table if not exists public.incomum_equipa (
  email text primary key check (email = lower(email)),
  nome text
);
alter table public.incomum_equipa enable row level security;
revoke all on public.incomum_equipa from anon, authenticated;

create or replace function public.incomum_e_equipa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.incomum_equipa
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) or public.e_equipa();
$$;
revoke all on function public.incomum_e_equipa() from public;
-- anon também precisa: as políticas de leitura pública chamam-na (só devolve verdadeiro/falso).
grant execute on function public.incomum_e_equipa() to anon, authenticated;

-- ---------- Catálogo ----------
-- Fotos, descrições e categorias ficam no catalogo.json do site; aqui só o que muda: preço, stock e se está à venda.
create table if not exists public.incomum_produtos (
  id text primary key,
  slug text not null unique,
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 0
);

create table if not exists public.incomum_variantes (
  id text primary key,
  produto_id text not null references public.incomum_produtos(id) on delete cascade,
  cor text,
  tam text,
  preco integer not null check (preco > 0),           -- cêntimos, IVA incluído
  promo integer check (promo is null or promo > 0),    -- cêntimos
  stock integer not null default 0 check (stock >= 0),
  ativo boolean not null default true,
  atualizado timestamptz not null default now()
);
create index if not exists incomum_variantes_produto on public.incomum_variantes (produto_id);

alter table public.incomum_produtos enable row level security;
alter table public.incomum_variantes enable row level security;
revoke all on public.incomum_produtos, public.incomum_variantes from anon, authenticated;
grant select on public.incomum_produtos, public.incomum_variantes to anon, authenticated;
grant update (ativo, ordem) on public.incomum_produtos to authenticated;
grant update (stock, preco, promo, ativo, atualizado) on public.incomum_variantes to authenticated;

drop policy if exists "publico le produtos" on public.incomum_produtos;
create policy "publico le produtos" on public.incomum_produtos
  for select to anon, authenticated using (ativo or public.incomum_e_equipa());
drop policy if exists "equipa muda produtos" on public.incomum_produtos;
create policy "equipa muda produtos" on public.incomum_produtos
  for update to authenticated using (public.incomum_e_equipa()) with check (public.incomum_e_equipa());

drop policy if exists "publico le variantes" on public.incomum_variantes;
create policy "publico le variantes" on public.incomum_variantes
  for select to anon, authenticated using (ativo or public.incomum_e_equipa());
drop policy if exists "equipa muda variantes" on public.incomum_variantes;
create policy "equipa muda variantes" on public.incomum_variantes
  for update to authenticated using (public.incomum_e_equipa()) with check (public.incomum_e_equipa());

-- ---------- Encomendas ----------
create table if not exists public.incomum_encomendas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity (start with 1001) unique,
  estado text not null default 'pendente'
    check (estado in ('pendente', 'paga', 'enviada', 'entregue', 'cancelada', 'expirada', 'falhou')),
  email text,
  nome text,
  telefone text,
  morada jsonb,                       -- { linha1, linha2, codigo_postal, cidade, pais }
  subtotal integer not null,          -- cêntimos
  portes integer not null default 0,
  total integer not null,
  stripe_sessao text unique,
  stripe_pi text,
  stripe_cliente text,
  notas text,
  criado timestamptz not null default now(),
  pago_em timestamptz,
  enviado_em timestamptz,
  entregue_em timestamptz,
  atualizado timestamptz not null default now()
);
create index if not exists incomum_encomendas_estado on public.incomum_encomendas (estado, criado desc);

create table if not exists public.incomum_itens (
  id bigint generated always as identity primary key,
  encomenda_id uuid not null references public.incomum_encomendas(id) on delete cascade,
  variante_id text not null references public.incomum_variantes(id),
  produto text not null,
  cor text,
  tam text,
  qtd integer not null check (qtd between 1 and 20),
  preco integer not null                -- cêntimos por unidade, no momento da compra
);
create index if not exists incomum_itens_encomenda on public.incomum_itens (encomenda_id);

alter table public.incomum_encomendas enable row level security;
alter table public.incomum_itens enable row level security;
revoke all on public.incomum_encomendas, public.incomum_itens from anon, authenticated;
grant select on public.incomum_encomendas, public.incomum_itens to authenticated;
grant update (estado, notas, enviado_em, entregue_em, atualizado) on public.incomum_encomendas to authenticated;

drop policy if exists "equipa le encomendas" on public.incomum_encomendas;
create policy "equipa le encomendas" on public.incomum_encomendas
  for select to authenticated using (public.incomum_e_equipa());
drop policy if exists "equipa muda encomendas" on public.incomum_encomendas;
create policy "equipa muda encomendas" on public.incomum_encomendas
  for update to authenticated using (public.incomum_e_equipa()) with check (public.incomum_e_equipa());
drop policy if exists "equipa le itens" on public.incomum_itens;
create policy "equipa le itens" on public.incomum_itens
  for select to authenticated using (public.incomum_e_equipa());

-- Lista de separação: a equipa marca cada peça quando a separa (fica guardado para todos os aparelhos).
alter table public.incomum_itens add column if not exists separado boolean not null default false;
grant update (separado) on public.incomum_itens to authenticated;
drop policy if exists "equipa marca itens" on public.incomum_itens;
create policy "equipa marca itens" on public.incomum_itens
  for update to authenticated using (public.incomum_e_equipa()) with check (public.incomum_e_equipa());

-- A equipa só pode mudar o estado para enviada, entregue ou cancelada, e nunca "despagar" uma encomenda.
create or replace function public.incomum_guarda_estado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado and current_user = 'authenticated' then
    if new.estado not in ('enviada', 'entregue', 'cancelada') then
      raise exception 'Estado não permitido: %', new.estado;
    end if;
    if old.estado not in ('paga', 'enviada', 'entregue') and new.estado <> 'cancelada' then
      raise exception 'Só encomendas pagas podem ser enviadas ou entregues';
    end if;
    if new.estado = 'enviada' and new.enviado_em is null then new.enviado_em := now(); end if;
    if new.estado = 'entregue' and new.entregue_em is null then new.entregue_em := now(); end if;
    -- Cancelar uma encomenda já paga devolve as peças ao stock (o reembolso faz-se no Stripe).
    if new.estado = 'cancelada' and old.estado in ('paga', 'enviada') then
      update public.incomum_variantes v
         set stock = v.stock + i.total, atualizado = now()
        from (select variante_id, sum(qtd) as total from public.incomum_itens
               where encomenda_id = new.id group by variante_id) i
       where v.id = i.variante_id;
    end if;
  end if;
  new.atualizado := now();
  return new;
end;
$$;
drop trigger if exists incomum_guarda_estado on public.incomum_encomendas;
create trigger incomum_guarda_estado before update on public.incomum_encomendas
  for each row execute function public.incomum_guarda_estado();

-- ---------- Pagamento confirmado (chamado só pelo webhook, com a chave de servidor) ----------
-- Passa de pendente a paga UMA vez e baixa o stock na mesma transação. Repetir o aviso do Stripe não faz nada.
create or replace function public.incomum_marcar_paga(
  p_encomenda uuid, p_pi text, p_cliente text,
  p_email text, p_nome text, p_telefone text, p_morada jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  mudou boolean;
begin
  update public.incomum_encomendas
     set estado = 'paga', pago_em = now(), stripe_pi = p_pi, stripe_cliente = p_cliente,
         email = coalesce(p_email, email), nome = coalesce(p_nome, nome),
         telefone = coalesce(p_telefone, telefone), morada = coalesce(p_morada, morada)
   where id = p_encomenda and estado in ('pendente', 'expirada', 'falhou')
  returning true into mudou;
  if not coalesce(mudou, false) then
    return false;
  end if;
  update public.incomum_variantes v
     set stock = greatest(0, v.stock - i.total), atualizado = now()
    from (select variante_id, sum(qtd) as total from public.incomum_itens
           where encomenda_id = p_encomenda group by variante_id) i
   where v.id = i.variante_id;
  return true;
end;
$$;
revoke all on function public.incomum_marcar_paga(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;

-- ---------- Página "obrigado" (pública) ----------
-- Quem tem o id da sessão Stripe (só o comprador, vem no link de regresso) vê o número e o estado.
create or replace function public.incomum_estado_encomenda(sessao text)
returns table (numero bigint, estado text, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.numero, e.estado, e.total
  from public.incomum_encomendas e
  where e.stripe_sessao = sessao and sessao like 'cs\_%'
  limit 1;
$$;
revoke all on function public.incomum_estado_encomenda(text) from public;
grant execute on function public.incomum_estado_encomenda(text) to anon, authenticated;

-- ---------- Clientes (painel) ----------
create or replace view public.incomum_clientes with (security_invoker = true) as
  select lower(email) as email,
         (array_agg(nome order by criado desc))[1] as nome,
         (array_agg(telefone order by criado desc))[1] as telefone,
         count(*) as encomendas,
         sum(total) as gasto,
         max(criado) as ultima
  from public.incomum_encomendas
  where estado in ('paga', 'enviada', 'entregue') and email is not null
  group by lower(email);
grant select on public.incomum_clientes to authenticated;

-- ---------- Acesso das Edge Functions (chave de servidor) ----------
-- Este projeto não dá acesso automático ao service_role em tabelas novas.
grant select, insert, update, delete on public.incomum_equipa, public.incomum_produtos, public.incomum_variantes,
  public.incomum_encomendas, public.incomum_itens to service_role;
grant select on public.incomum_clientes to service_role;
grant usage, select on sequence public.incomum_encomendas_numero_seq, public.incomum_itens_id_seq to service_role;
grant execute on function public.incomum_marcar_paga(uuid, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.incomum_e_equipa(), public.incomum_estado_encomenda(text) to service_role;
