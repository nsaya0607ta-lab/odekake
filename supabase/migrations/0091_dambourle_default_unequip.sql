-- 初期の無料ダンボールを選んだときは、装備レコードを削除して未装備状態へ戻す。
-- 通常ダンボールの所持・スキン解放チェックは従来どおり維持する。
create or replace function public.set_dambourle_equipped(p_item_id text, p_skin_index integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_level integer;
  v_max_tier integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  if p_item_id = 'default' then
    if p_skin_index <> 0 then raise exception '初期のダンボールにはスキンを設定できません'; end if;
    delete from public.user_dambourle_equipped where user_id = v_user_id;
    return;
  end if;

  select count into v_count from public.user_dambourle_items
   where user_id = v_user_id and item_id = p_item_id;
  if coalesce(v_count, 0) <= 0 then
    raise exception 'このダンボールはまだガチャで手に入れていません';
  end if;

  v_level := public.dambourle_level_for_count(p_item_id, v_count);
  v_max_tier := public.dambourle_skin_tier_for_item(p_item_id, v_level);

  if p_skin_index < 0 or p_skin_index > v_max_tier then
    raise exception 'このスキンはまだ解放されていません';
  end if;

  insert into public.user_dambourle_equipped (user_id, item_id, skin_index)
  values (v_user_id, p_item_id, p_skin_index)
  on conflict (user_id) do update
    set item_id = excluded.item_id,
        skin_index = excluded.skin_index,
        updated_at = now();
end;
$$;

grant execute on function public.set_dambourle_equipped(text, integer) to authenticated;
