-- =============================================================
-- 青コインをもらえるイベントを増やす
-- =============================================================
-- 0111（青コイン）の後に適用する。数はアプリ側の src/lib/blue-coin-rewards.ts と同じにする。
-- ・はじめての市区町村を登録すると 100、はじめての都道府県を登録すると 600。
--   EXP の「初めての市区町村／都道府県」（exp_events。1人1か所につき1回だけ入る）に合わせて付与する。
--   訪問を消して登録しなおしても、青コインのキーが残るので二重にはもらえない。
--   これより前の登録にはさかのぼって付与しない（この SQL を適用したあとの登録から）。
-- ・ログインボーナス（黄色のコイン）を、連続日数ではなく通算のログイン日数で数える。
--   これまでは1日空くと1日目（100枚）へ戻っていたが、休んでも戻らず、通算の続きから
--   100→120→140→160→180→200→300 をくり返す。
-- ・ログインした日の通算（1日目から数えた合計の日数。休んでもへらない）が 7 の倍数になった日に、青コイン 400。
--   これまでのログイン日（coin_events の login）も数に入る。どちらも claim_login_bonus を作り直して入れる。
begin;

do $$
begin
  if to_regprocedure('public.add_blue_coin_event(uuid, text, integer, text, jsonb)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'BLUE_COIN_EVENTS_MISSING_DEPENDENCY',
      hint = '青コインの仕組み（0111）を先に適用してください。';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- はじめての場所
-- -------------------------------------------------------------
create or replace function public.award_first_place_blue_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount integer := case new.event_type when 'first_municipality' then 100 when 'first_prefecture' then 600 else 0 end;
begin
  if v_amount = 0 then
    return new;
  end if;
  -- 青コインで失敗しても、訪問の登録そのものは止めない
  begin
    perform public.add_blue_coin_event(
      new.user_id, 'first_place', v_amount,
      'first-place:' || new.idempotency_key,
      jsonb_build_object(
        'label', case new.event_type when 'first_municipality' then 'はじめての市区町村' else 'はじめての都道府県' end,
        'prefecture_code', new.prefecture_code,
        'municipality_code', new.municipality_code
      )
    );
  exception when others then
    raise warning 'first place blue coins failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists exp_events_award_first_place_blue_coins on public.exp_events;
create trigger exp_events_award_first_place_blue_coins
after insert on public.exp_events
for each row
when (new.event_type in ('first_municipality', 'first_prefecture'))
execute function public.award_first_place_blue_coins();

-- -------------------------------------------------------------
-- 通算ログイン（0028 の claim_login_bonus を、連続ではなく通算で数え、通算7日ごとの青コインを足したもの）
-- -------------------------------------------------------------
create or replace function public.claim_login_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_prior_days integer := 0;
  v_streak_day integer;
  v_next_day integer;
  v_amount integer;
  v_event_id uuid;
  v_balance integer;
  v_blue_amount integer := 0;
  v_total_days integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  -- きのうまでに開いた日の合計（通算）。休んでも1日目へは戻らず、7日ごとにひとまわりする
  select count(*)::integer into v_prior_days
    from public.coin_events
   where user_id = v_user_id
     and event_type = 'login'
     and event_date < v_today;

  v_streak_day := (v_prior_days % 7) + 1;
  v_next_day := (v_streak_day % 7) + 1;
  v_amount := public.coin_login_bonus(v_streak_day);

  insert into public.coin_events (
    user_id, event_type, amount, idempotency_key, event_date, metadata
  ) values (
    v_user_id, 'login', v_amount, 'login:' || v_today::text, v_today,
    jsonb_build_object('label', 'ログインボーナス', 'streak_day', v_streak_day)
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_event_id;

  -- 通算のログイン日数（きょうを入れて）。7日ごとに青コインもいっしょに
  v_total_days := v_prior_days + 1;

  if v_event_id is not null and v_total_days > 0 and v_total_days % 7 = 0 then
    if public.add_blue_coin_event(
      v_user_id, 'login_total', 400,
      'login-total:' || v_total_days::text,
      jsonb_build_object('label', '通算' || v_total_days::text || '日ログイン', 'total_days', v_total_days)
    ) then
      v_blue_amount := 400;
    end if;
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_event_id is not null,
    'amount', case when v_event_id is not null then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'date', v_today,
    'streak_day', v_streak_day,
    'next_amount', public.coin_login_bonus(v_next_day),
    'blue_amount', v_blue_amount,
    'total_days', v_total_days
  );
end;
$$;

grant execute on function public.claim_login_bonus() to authenticated;

commit;

notify pgrst, 'reload schema';
