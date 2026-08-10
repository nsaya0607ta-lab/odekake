-- =============================================================
-- ログインボーナス
-- =============================================================
-- 毎日1回、その日はじめてアプリを開いたときに 100 コイン配る。
-- 新しい通貨もテーブルも作らず、0011 のおでかけコインの台帳へ1件積むだけ。
-- 残高は既存のトリガー（sync_user_coin_balance）が直す。
--
-- 「1日1回」は台帳の一意キー (user_id, idempotency_key) だけで担保する。
-- キーが 'login:{日本時間の日付}' なので、同じ日に何度呼ばれても2件目は入らない。
-- 同時に複数のタブから呼ばれても、DB の制約で1件しか通らない。
-- アプリ側でも localStorage で1日1回に絞っているが、あれは通信を減らすためで、
-- 二重付与を止めているのはここ。
--
-- 日付は必ず日本時間で数える。UTC のままだと 0:00〜9:00 が前日扱いになり、
-- 朝に開いた人が前日ぶんをもう一度受け取れてしまう。

-- 獲得の種類に 'login' を足す（'unlock' は将来のショップ用のまま）。
alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in ('level_up', 'steps', 'unlock', 'gacha', 'login'));

-- 付与量。src/lib/coins.ts の LOGIN_BONUS_COINS と必ず同じにする。
create or replace function public.coin_login_bonus()
returns integer
language sql
immutable
set search_path = public
as $$
  select 100;
$$;

-- -------------------------------------------------------------
-- その日ぶんを受け取る
-- -------------------------------------------------------------
-- 返り値の JSON:
--   { "ok": true, "granted": true,  "amount": 100, "balance": 残高, "date": "YYYY-MM-DD" }
--   { "ok": true, "granted": false, "amount": 0,   "balance": 残高, "date": "YYYY-MM-DD" }
--                                   … その日はもう受け取り済み
create or replace function public.claim_login_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_amount integer := public.coin_login_bonus();
  v_event_id uuid;
  v_balance integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  insert into public.coin_events (
    user_id, event_type, amount, idempotency_key, event_date, metadata
  ) values (
    v_user_id, 'login', v_amount, 'login:' || v_today::text, v_today,
    jsonb_build_object('label', 'ログインボーナス')
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_event_id;

  -- 残高はトリガーが同じトランザクションで更新済みなので、ここで読めば新しい値になる。
  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_event_id is not null,
    'amount', case when v_event_id is not null then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'date', v_today
  );
end;
$$;

grant execute on function public.claim_login_bonus() to authenticated;
