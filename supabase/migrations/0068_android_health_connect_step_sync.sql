-- Android Health Connectの同期元をiPhoneショートカットと区別する。
-- 既存の3引数RPCは後方互換用に残す。
create or replace function public.record_daily_steps_with_token(
  p_token text, p_step_date date, p_steps integer, p_source text
)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  v_token uuid;
  v_user_id uuid;
  v_source text;
begin
  begin v_token := p_token::uuid;
  exception when invalid_text_representation then raise exception 'Invalid sync token';
  end;
  select user_id into v_user_id from public.steps_sync_tokens where token = v_token;
  if v_user_id is null then raise exception 'Invalid sync token'; end if;
  v_source := case p_source when 'android-health-connect' then 'android-health-connect' else 'iphone-shortcuts' end;
  return public.record_daily_steps_for_user(v_user_id, p_step_date, p_steps, v_source);
end;
$$;

revoke all on function public.record_daily_steps_with_token(text, date, integer, text) from public;
grant execute on function public.record_daily_steps_with_token(text, date, integer, text) to anon, authenticated;
