-- =============================================================
-- ご当地ピンボール：台を「県ごと」から「マップごと」にする
-- =============================================================
-- 0136（ピンボールの報酬を青コインに）の後に適用する。
-- ・台えらびは、県ごとの台（同じ形で色ちがい）から、形のちがうマップ（いつもの台・はねはね台・くぎと風車の台・
--   ジェットコースター台…）にした。記録の table_id には、マップの id（'default'・'bumper' など）が入る。
-- ・これまでの記録（'default' と都道府県コード）はそのまま残す（都道府県コードの台は、いつもの台と同じ形だったので、
--   アプリではいつもの台のベストとして数える）。新しく記録できるのはマップの id だけ。
-- ・record_pinball_result は 0136 と同じ（青コインの換算も同じ）。台の id の確かめ方だけを変える。
--   アプリ側で、この関数が INVALID_TABLE を返すとき（このマイグレーションがまだのとき）は「準備中」として扱う。
begin;

do $$
begin
  if to_regprocedure('public.add_blue_coin_event(uuid, text, integer, text, jsonb)') is null
     or to_regclass('public.pinball_scores') is null then
    raise exception using
      errcode = 'P0001',
      message = 'PINBALL_MAPS_MISSING_DEPENDENCY',
      hint = 'ご当地ピンボール（0134）と青コインの報酬（0136）を先に適用してください。';
  end if;
end;
$$;

-- 台の id：これまでの 'default'・都道府県コードと、マップの id（英小文字・数字・_）
alter table public.pinball_scores drop constraint if exists pinball_scores_table_format;
alter table public.pinball_scores add constraint pinball_scores_table_format check (table_id ~ '^[a-z0-9_]{1,32}$');

-- -------------------------------------------------------------
-- 結果の記録と青コインの付与（0136 と同じ。台の id の確かめ方だけちがう）
-- -------------------------------------------------------------
create or replace function public.record_pinball_result(
  p_round_id text,
  p_table text,
  p_score integer,
  p_duration_ms integer,
  p_items integer,
  p_conquests integer,
  p_jackpots integer,
  p_max_combo integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_applied boolean := false;
  v_prev_best integer;
  v_best integer;
  v_coins integer;
  v_balance integer;
  v_recent integer;
  -- アプリ側の COIN_POINTS / COIN_MAX と同じ
  v_points_per_coin constant integer := 11875;
  v_max_coins constant integer := 2400;
  -- 1秒あたりにとれる得点の上限の目安（MAX_SCORE_PER_SECOND と同じ）
  v_max_per_second constant integer := 400000;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_ROUND_ID';
  end if;
  -- 台はマップの id（英小文字ではじまる、英小文字・数字・_ の32文字まで。'default'・'bumper' など）
  if p_table is null or p_table !~ '^[a-z][a-z0-9_]{0,31}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_TABLE';
  end if;
  if p_score is null or p_score < 0 or p_score > 200000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;
  if p_duration_ms is null or p_duration_ms < 0 or p_duration_ms > 10800000 then
    raise exception using errcode = 'P0001', message = 'INVALID_DURATION';
  end if;
  -- 遊んだ時間のわりに大きすぎるスコアは受けつけない（はじめの30秒ぶんは余裕をみる）
  if p_score::bigint > ((p_duration_ms::bigint / 1000) + 30) * v_max_per_second then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;
  if p_items is null or p_items not between 0 and 10000
     or p_conquests is null or p_conquests not between 0 and 1000
     or p_jackpots is null or p_jackpots not between 0 and 10000
     or p_max_combo is null or p_max_combo not between 0 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_COUNTS';
  end if;

  -- 新しいプレイは1時間に40回まで（API の制限と同じ。関数を直接呼んで青コインをかせがれないように）。
  -- 同じ round_id の再送は、下で前と同じ結果を返すのでそのまま通す
  if not exists (select 1 from public.pinball_scores s where s.user_id = v_user_id and s.round_id = p_round_id) then
    select count(*) into v_recent
      from public.pinball_scores s
     where s.user_id = v_user_id and s.played_at > now() - interval '1 hour';
    if v_recent >= 40 then
      raise exception using errcode = 'P0001', message = 'TOO_MANY_ROUNDS';
    end if;
  end if;

  select max(s.score) into v_prev_best
    from public.pinball_scores s
   where s.user_id = v_user_id and s.table_id = p_table;

  v_coins := least(v_max_coins, floor(p_score / v_points_per_coin::numeric)::integer);

  insert into public.pinball_scores (user_id, round_id, table_id, score, duration_ms, items, conquests, jackpots, max_combo, coins)
  values (v_user_id, p_round_id, p_table, p_score, p_duration_ms, p_items, p_conquests, p_jackpots, p_max_combo, v_coins)
  on conflict (user_id, round_id) do nothing;
  v_applied := found;

  if v_applied then
    if v_coins > 0 then
      perform public.add_blue_coin_event(
        v_user_id,
        'pinball',
        v_coins,
        'pinball:' || p_round_id,
        jsonb_build_object('label', 'ご当地ピンボール', 'table', p_table, 'score', p_score, 'items', p_items, 'conquests', p_conquests)
      );
    end if;
  else
    -- 再送：1回目に付けた枚数を返す（0136 より前のプレイは赤コインで付いているので、もう付けない）
    select s.coins into v_coins
      from public.pinball_scores s
     where s.user_id = v_user_id and s.round_id = p_round_id;
  end if;

  select max(s.score) into v_best
    from public.pinball_scores s
   where s.user_id = v_user_id and s.table_id = p_table;

  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'coins', greatest(coalesce(v_coins, 0), 0),
    'balance', coalesce(v_balance, 0),
    'best', coalesce(v_best, 0),
    'is_best', v_applied and p_score > coalesce(v_prev_best, -1) and p_score > 0
  );
end;
$$;

revoke all on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer) to authenticated;

comment on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer) is
  'ご当地ピンボールの1プレイを記録し、スコア÷11875（切り捨て、1プレイ2400まで）を青コインとして付与する。同じ round_id は二重に記録・付与しない。';

commit;

notify pgrst, 'reload schema';
