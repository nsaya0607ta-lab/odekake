-- =============================================================
-- わんこのおへや：窓・かべの棚・かけ時計・お天気ボードも、青コインで買うものにする
-- =============================================================
-- ・家具と同じく、窓・棚など（もようがえの「窓・棚」）も青コインで買う。持っている数は user_room_furniture に
--   家具といっしょに入れる（furniture 列に window / shelf / clock / weather）。
-- ・1種類あたり持てる数は、家具2こ／窓2こ／かべの棚3こ／かけ時計1こ／お天気ボード1こ（room_furniture_max）。
--   値段は窓3,000／かべの棚1,000／かけ時計1,500／お天気ボード2,000（アプリ側の FIXTURES[id].price と同じ）。
-- ・これまでの窓・棚などは、いったんすべてなくす（部屋から外す。持っている数は全員0から）。
--   外した棚に乗せていたもの（図鑑アイテム・トロフィーなど）は、部屋から外さない（アプリが床に下ろして表示する）。
--   図鑑アイテム・写真・トロフィー・ペナント・家具は外さない。図鑑アイテムの持ち物のテーブルには一切さわらない。
begin;

do $$
begin
  if to_regclass('public.user_room_furniture') is null then
    raise exception using
      errcode = 'P0001',
      message = 'ROOM_FIXTURES_SHOP_MISSING_DEPENDENCY',
      hint = '青コインと家具の購入（0111・0112）を先に適用してください。';
  end if;
end;
$$;

-- かべの棚は3こまで持てるので、持てる数の上限を広げる（種類ごとの上限は room_furniture_max で見る）
alter table public.user_room_furniture drop constraint if exists user_room_furniture_count_check;
alter table public.user_room_furniture add constraint user_room_furniture_count_check check (count between 0 and 3);

/** 値段（青コイン）。アプリ側の FURNITURE[id].price / FIXTURES[id].price と同じ。知らないものは null */
create or replace function public.room_furniture_price(p_furniture text)
returns integer
language sql
immutable
as $$
  select case p_furniture
    when 'bowl' then 800
    when 'plant' then 1200
    when 'lamp' then 2000
    when 'table' then 2500
    when 'bookshelf' then 3000
    when 'whiteboard' then 3000
    when 'dog-bed' then 4000
    when 'dog-house' then 5000
    when 'sofa' then 6000
    when 'window' then 3000
    when 'shelf' then 1000
    when 'clock' then 1500
    when 'weather' then 2000
    else null
  end;
$$;

/** 1種類あたり持てる数。アプリ側の FURNITURE_MAX / FIXTURES[id].count と同じ */
create or replace function public.room_furniture_max(p_furniture text)
returns integer
language sql
immutable
as $$
  select case p_furniture
    when 'window' then 2
    when 'shelf' then 3
    when 'clock' then 1
    when 'weather' then 1
    else 2
  end;
$$;

-- 1こ買う（同じ人の同じものは、行のロックで1つずつ）
create or replace function public.buy_room_furniture(p_furniture text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer := public.room_furniture_price(p_furniture);
  v_max integer := public.room_furniture_max(p_furniture);
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
  if v_owned >= v_max then
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
  'わんこのおへやの家具・窓・棚・時計・お天気ボードを1こ、青コインで買う（持てる数は room_furniture_max、値段は room_furniture_price）。';

-- これまでの窓・棚などを部屋から外す（key が fixture: のものだけ。0113 より前に買った分は無いので、全員0から）。
-- v を 2 にして、古い形の部屋でも、読みこむときに窓・棚が自動で足されないようにする。
update public.user_rooms r
   set layout = jsonb_set(
         jsonb_set(
           r.layout,
           '{items}',
           coalesce((
             select jsonb_agg(it.value order by it.ord)
               from jsonb_array_elements(r.layout -> 'items') with ordinality as it(value, ord)
              where coalesce(it.value ->> 'key', '') not like 'fixture:%'
           ), '[]'::jsonb)
         ),
         '{v}', '2'::jsonb
       ),
       updated_at = now()
 where jsonb_typeof(r.layout -> 'items') = 'array';

commit;

notify pgrst, 'reload schema';
