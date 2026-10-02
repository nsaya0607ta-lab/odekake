-- =============================================================
-- わんこのおへや：これまでの家具をいったんすべてなくす（図鑑アイテムはそのまま）
-- =============================================================
-- 0111 では「部屋に置いていた家具は、持っていることにする」としていたが、
-- 家具はすべて青コインで買いなおす形にする。
-- ・持っている家具の数は、青コインで実際に買った回数（blue_coin_events の room_furniture）だけにする。
--   0111 で無料で持たせた分は0になる。0112 を適用する前に青コインで買った分は、そのまま残る。
-- ・部屋に置いている家具（key が furniture: のもの）は、持っている数をこえる分を外す。
--   図鑑アイテム・写真・トロフィー・ペナント・窓や棚は外さない。図鑑アイテムの持ち物のテーブルには一切さわらない。
-- ・buy_room_furniture の台帳のキーを、買うたびにちがうものにする（持っている数を作りなおしても、キーがぶつからない）。
--   同じ人の同じ家具の買い物は、行のロックで1つずつ順に処理する。
begin;

do $$
begin
  if to_regclass('public.user_room_furniture') is null or to_regclass('public.blue_coin_events') is null then
    raise exception using
      errcode = 'P0001',
      message = 'RESET_ROOM_FURNITURE_MISSING_DEPENDENCY',
      hint = '青コインと家具の購入（0111）を先に適用してください。';
  end if;
end;
$$;

-- 同じ時に家具を買われて、数がずれないようにする
lock table public.user_room_furniture in exclusive mode;

-- 持っている家具の数 ＝ 青コインで買った回数（2こまで）
update public.user_room_furniture f
   set count = least(2, (
         select count(*)
           from public.blue_coin_events e
          where e.user_id = f.user_id
            and e.event_type = 'room_furniture'
            and e.amount < 0
            and e.metadata ->> 'furniture' = f.furniture
       ))::integer,
       updated_at = now();

delete from public.user_room_furniture where count = 0;

-- 部屋に置いている家具は、持っている数まで（家具でないものは、そのまま同じ順で残す）
update public.user_rooms r
   set layout = jsonb_set(
         r.layout,
         '{items}',
         coalesce((
           select jsonb_agg(x.value order by x.ord)
             from (
               select it.value, it.ord,
                      row_number() over (partition by it.value ->> 'key' order by it.ord) as n
                 from jsonb_array_elements(r.layout -> 'items') with ordinality as it(value, ord)
             ) x
            where coalesce(x.value ->> 'key', '') not like 'furniture:%'
               or x.n <= coalesce((
                    select f.count from public.user_room_furniture f
                     where f.user_id = r.user_id and f.furniture = substr(x.value ->> 'key', 11)
                  ), 0)
         ), '[]'::jsonb)
       ),
       updated_at = now()
 where jsonb_typeof(r.layout -> 'items') = 'array'
   and exists (
     select 1 from jsonb_array_elements(r.layout -> 'items') it
      where it ->> 'key' like 'furniture:%'
   );

-- 家具を1こ買う（同じ人の同じ家具は、行のロックで1つずつ）
create or replace function public.buy_room_furniture(p_furniture text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer := public.room_furniture_price(p_furniture);
  v_owned integer;
  v_balance integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_price is null then
    raise exception using errcode = 'P0001', message = 'INVALID_FURNITURE';
  end if;

  insert into public.user_room_furniture (user_id, furniture) values (v_user_id, p_furniture) on conflict do nothing;
  select count into v_owned from public.user_room_furniture where user_id = v_user_id and furniture = p_furniture for update;
  if v_owned >= 2 then
    raise exception using errcode = 'P0001', message = 'FURNITURE_LIMIT';
  end if;

  if not public.add_blue_coin_event(
    v_user_id, 'room_furniture', -v_price,
    'room-furniture:' || p_furniture || ':' || gen_random_uuid()::text,
    jsonb_build_object('label', 'おへやの家具', 'furniture', p_furniture)
  ) then
    raise exception using errcode = 'P0001', message = 'PURCHASE_CONFLICT';
  end if;

  update public.user_room_furniture set count = v_owned + 1, updated_at = now() where user_id = v_user_id and furniture = p_furniture;
  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
  return jsonb_build_object('ok', true, 'furniture', p_furniture, 'owned', v_owned + 1, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.buy_room_furniture(text) from public, anon;
grant execute on function public.buy_room_furniture(text) to authenticated;

comment on function public.buy_room_furniture(text) is
  'わんこのおへやの家具を1こ、青コインで買う（1種類2こまで。値段は room_furniture_price）。';

commit;

notify pgrst, 'reload schema';
