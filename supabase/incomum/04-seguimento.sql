-- Incomum.eu · fase 4: número de seguimento da transportadora.
-- A equipa escreve-o no painel ao marcar a encomenda como enviada; o cliente vê-o na conta e no link do e-mail.
alter table public.incomum_encomendas
  add column if not exists transportadora text check (transportadora is null or length(transportadora) between 2 and 30),
  add column if not exists seguimento text check (seguimento is null or seguimento ~ '^[A-Za-z0-9 -]{4,40}$');
grant update (transportadora, seguimento) on public.incomum_encomendas to authenticated;

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
