-- Marcação da chamada de diagnóstico (calendário da página /diagnostico/obrigado/).
-- Guarda a hora escolhida no próprio pedido. Dois pedidos não podem ter a mesma hora.
-- Horários (hora de Portugal), chamadas de 20 min, de 30 em 30 min:
--   domingo e segunda: 09:00 a 19:30 (última chamada acaba às 19:50)
--   terça e quarta:    09:00 a 14:00 (última chamada acaba às 14:20, antes das 14:30)
-- Pode correr-se mais de uma vez.

alter table public.pedidos add column if not exists marcado_para timestamptz;
create unique index if not exists pedidos_marcado_para_unico on public.pedidos (marcado_para) where marcado_para is not null;

-- Regra dos horários, igual à do site (diagnostico/calendario.js).
create or replace function public.horario_valido(p_inicio timestamptz) returns boolean
language sql immutable set search_path = public as $$
  with l as (select (p_inicio at time zone 'Europe/Lisbon') as t)
  select extract(second from t) = 0
     and extract(minute from t) in (0, 30)
     and case extract(isodow from t)
           when 7 then t::time between time '09:00' and time '19:30'   -- domingo
           when 1 then t::time between time '09:00' and time '19:30'   -- segunda
           when 2 then t::time between time '09:00' and time '14:00'   -- terça
           when 3 then t::time between time '09:00' and time '14:00'   -- quarta
           else false
         end
  from l;
$$;

-- Horas já ocupadas (só as horas, sem dados de ninguém).
create or replace function public.horarios_ocupados() returns setof timestamptz
language sql stable security definer set search_path = public as $$
  select marcado_para from public.pedidos
   where marcado_para is not null and marcado_para > now() - interval '1 hour'
   order by 1;
$$;
revoke all on function public.horarios_ocupados() from public;
grant execute on function public.horarios_ocupados() to anon, authenticated;

-- Marcar: só para pedidos criados nas últimas 48 h, com pelo menos 2 h de antecedência e até 15 dias.
-- Devolve 'ok', 'ocupado' ou 'invalido'. Pode trocar a hora que já tinha escolhido.
create or replace function public.marcar_diagnostico(p_id uuid, p_inicio timestamptz) returns text
language plpgsql security definer set search_path = public as $$
begin
  if p_inicio is null or not public.horario_valido(p_inicio)
     or p_inicio < now() + interval '2 hours' or p_inicio > now() + interval '15 days' then
    return 'invalido';
  end if;
  update public.pedidos
     set marcado_para = p_inicio,
         estado = case when estado = 'novo' then 'diagnostico' else estado end
   where id = p_id and criado > now() - interval '48 hours';
  if not found then return 'invalido'; end if;
  return 'ok';
exception when unique_violation then
  return 'ocupado';
end;
$$;
revoke all on function public.marcar_diagnostico(uuid, timestamptz) from public;
grant execute on function public.marcar_diagnostico(uuid, timestamptz) to anon, authenticated;
