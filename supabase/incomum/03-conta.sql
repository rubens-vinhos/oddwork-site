-- Incomum.eu · fase 3: estado "em preparação", link de acompanhamento, conta do cliente e tempo real.
-- Corre depois de 01-esquema.sql. Pode correr-se várias vezes.
--
-- Segurança (o Auth é partilhado com a Oddwork):
--   · as inscrições livres continuam DESLIGADAS; só o webhook cria a conta de quem pagou (já confirmada);
--   · um cliente só lê as encomendas pagas com o seu e-mail confirmado e nunca escreve nada;
--   · nada da Oddwork muda: as tabelas dela só abrem com public.e_equipa().

-- ---------- Novas colunas ----------
alter table public.incomum_encomendas
  add column if not exists token text,
  add column if not exists preparacao_em timestamptz,
  add column if not exists email_enviado timestamptz;
-- 64 carateres hexadecimais aleatórios (2 × UUID v4): impossível de adivinhar.
alter table public.incomum_encomendas
  alter column token set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update public.incomum_encomendas
   set token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where token is null;
alter table public.incomum_encomendas alter column token set not null;
create unique index if not exists incomum_encomendas_token on public.incomum_encomendas (token);

-- O token e o envio do e-mail só os mexe o servidor.
revoke update on public.incomum_encomendas from authenticated;
grant update (estado, notas, preparacao_em, enviado_em, entregue_em, atualizado) on public.incomum_encomendas to authenticated;

-- ---------- Estado "preparacao" ----------
alter table public.incomum_encomendas drop constraint if exists incomum_encomendas_estado_check;
alter table public.incomum_encomendas add constraint incomum_encomendas_estado_check
  check (estado in ('pendente', 'paga', 'preparacao', 'enviada', 'entregue', 'cancelada', 'expirada', 'falhou'));

create or replace function public.incomum_guarda_estado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado and current_user = 'authenticated' then
    if new.estado not in ('preparacao', 'enviada', 'entregue', 'cancelada') then
      raise exception 'Estado não permitido: %', new.estado;
    end if;
    if new.estado <> 'cancelada' and old.estado not in ('paga', 'preparacao', 'enviada', 'entregue') then
      raise exception 'Só encomendas pagas podem avançar';
    end if;
    if new.estado = 'preparacao' and new.preparacao_em is null then new.preparacao_em := now(); end if;
    if new.estado = 'enviada' and new.enviado_em is null then new.enviado_em := now(); end if;
    if new.estado = 'entregue' and new.entregue_em is null then new.entregue_em := now(); end if;
    -- Cancelar uma encomenda já paga devolve as peças ao stock (o reembolso faz-se no Stripe).
    if new.estado = 'cancelada' and old.estado in ('paga', 'preparacao', 'enviada') then
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

-- A vista de clientes conta também as encomendas em preparação.
create or replace view public.incomum_clientes with (security_invoker = true) as
  select lower(email) as email,
         (array_agg(nome order by criado desc))[1] as nome,
         (array_agg(telefone order by criado desc))[1] as telefone,
         count(*) as encomendas,
         sum(total) as gasto,
         max(criado) as ultima
  from public.incomum_encomendas
  where estado in ('paga', 'preparacao', 'enviada', 'entregue') and email is not null
  group by lower(email);

-- ---------- Conta do cliente ----------
-- E-mail da sessão, só se estiver confirmado no Auth (não confia só no token).
create or replace function public.incomum_meu_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;
revoke all on function public.incomum_meu_email() from public;
grant execute on function public.incomum_meu_email() to authenticated;

drop policy if exists "cliente le as suas encomendas" on public.incomum_encomendas;
create policy "cliente le as suas encomendas" on public.incomum_encomendas
  for select to authenticated
  using (estado in ('paga', 'preparacao', 'enviada', 'entregue') and lower(email) = public.incomum_meu_email());

drop policy if exists "cliente le os seus itens" on public.incomum_itens;
create policy "cliente le os seus itens" on public.incomum_itens
  for select to authenticated
  using (exists (
    select 1 from public.incomum_encomendas e
    where e.id = encomenda_id
      and e.estado in ('paga', 'preparacao', 'enviada', 'entregue')
      and lower(e.email) = public.incomum_meu_email()
  ));

-- ---------- Página de obrigado (pública, com o id da sessão Stripe) ----------
drop function if exists public.incomum_estado_encomenda(text);
create function public.incomum_estado_encomenda(sessao text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', e.numero, 'estado', e.estado,
    'subtotal', e.subtotal, 'portes', e.portes, 'total', e.total,
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

-- ---------- Acompanhar sem conta (link com token no e-mail) ----------
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
    'subtotal', e.subtotal, 'portes', e.portes, 'total', e.total,
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

-- ---------- Tempo real ----------
-- O Realtime respeita o RLS: cada cliente só recebe as mudanças das suas encomendas; a equipa recebe todas.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incomum_encomendas') then
    alter publication supabase_realtime add table public.incomum_encomendas;
  end if;
end $$;
