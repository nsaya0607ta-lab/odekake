-- =============================================================
-- ご当地ピンボール：部品の値段を上げる・新しい部品（障害物）を足す
-- =============================================================
-- 0138（ステージ・部品・赤コイン）の後に適用する。
-- ・部品の値段を、どれも3倍にする（バンパー 300 → 900、てっぺんランプ 1200 → 3600 など）。
--   はじめから持っている数・持てる数はそのまま。買ってあった部品（user_pinball_parts）もそのまま。
-- ・新しい部品を足す：ガイドレール（rail）・ゴムのかべ（rubber）・ブロック（block）・回転バー（bar）・
--   スピナー（spinner）・ドロップターゲット（drop）。カタログ（pinball_part_catalog）と、ステージの保存
--   （save_pinball_stage）で使える部品の種類に足す。
-- 値段・数・種類は、アプリの src/lib/games/pinball/stage.ts（PINBALL_PARTS・StagePart）と同じにする。
-- 部品の形・向き・置き方（すき間など）は、これまでどおりアプリの API（parseStageSpec・validateStage）で確かめる。
begin;

do $$
begin
  if to_regprocedure('public.pinball_part_catalog()') is null
     or to_regprocedure('public.save_pinball_stage(uuid, text, jsonb, boolean)') is null
     or to_regclass('public.user_pinball_parts') is null then
    raise exception using
      errcode = 'P0001',
      message = 'PINBALL_PARTS_MISSING_DEPENDENCY',
      hint = 'ご当地ピンボールのステージと部品（0138）を先に適用してください。';
  end if;
end;
$$;

/** 部品のカタログ。アプリの PINBALL_PARTS と同じ（price＝1回の値段、pack＝1回で増える数、free＝はじめから持っている数、max_count＝持てる数） */
create or replace function public.pinball_part_catalog()
returns table (part text, price integer, pack integer, free integer, max_count integer)
language sql
immutable
set search_path = public
as $$
  values
    ('bumper'::text, 900, 1, 3, 8),
    ('pinwheel'::text, 1200, 1, 1, 4),
    ('post'::text, 150, 1, 4, 16),
    ('peg'::text, 300, 10, 10, 60),
    ('sling'::text, 1200, 1, 0, 4),
    ('rail'::text, 450, 1, 2, 8),
    ('rubber'::text, 600, 1, 0, 6),
    ('block'::text, 450, 1, 0, 6),
    ('bar'::text, 1500, 1, 0, 2),
    ('spinner'::text, 1200, 1, 0, 3),
    ('drop'::text, 900, 1, 0, 6),
    ('ramp_top'::text, 3600, 1, 0, 1),
    ('ramp_cross'::text, 5400, 1, 0, 1)
$$;

grant execute on function public.pinball_part_catalog() to authenticated;

-- ステージの保存：0138 と同じ。使える部品の種類に、新しい部品を足しただけ
create or replace function public.save_pinball_stage(p_id uuid, p_name text, p_spec jsonb, p_shared boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_parts jsonb;
  v_items jsonb;
  v_count integer;
  v_row public.pinball_stages%rowtype;
  v_layout_changed boolean := true;
  r record;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if char_length(v_name) not between 1 and 16 or v_name ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'INVALID_NAME';
  end if;

  -- データの形
  if p_spec is null or jsonb_typeof(p_spec) <> 'object' or pg_column_size(p_spec) > 16384
     or p_spec -> 'v' is distinct from '1'::jsonb
     or coalesce(p_spec ->> 'look', '') not in ('default', 'bumper', 'pachinko', 'coaster')
     or coalesce(p_spec ->> 'ramp', '') not in ('standard', 'top', 'cross') then
    raise exception using errcode = 'P0001', message = 'INVALID_STAGE';
  end if;
  v_parts := p_spec -> 'parts';
  v_items := p_spec -> 'items';
  if jsonb_typeof(v_parts) is distinct from 'array' or jsonb_array_length(v_parts) > 120
     or jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) <> 3 then
    raise exception using errcode = 'P0001', message = 'INVALID_STAGE';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_parts) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e ->> 'kind', '') not in ('bumper', 'pinwheel', 'post', 'peg', 'sling', 'rail', 'rubber', 'block', 'bar', 'spinner', 'drop')
        or jsonb_typeof(e -> 'x') is distinct from 'number' or jsonb_typeof(e -> 'y') is distinct from 'number'
        or (e ->> 'x')::numeric not between 0 and 480 or (e ->> 'y')::numeric not between 0 and 1000
  ) or exists (
    select 1 from jsonb_array_elements(v_items) e
     where jsonb_typeof(e) <> 'object'
        or jsonb_typeof(e -> 'x') is distinct from 'number' or jsonb_typeof(e -> 'y') is distinct from 'number'
        or (e ->> 'x')::numeric not between 0 and 480 or (e ->> 'y')::numeric not between 0 and 1000
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STAGE';
  end if;

  -- 持っている部品（はじめのぶん＋買ったぶん）をこえていないか
  for r in
    select c.part,
           least(c.max_count, c.free + coalesce(u.count, 0)) as owned,
           case c.part
             when 'ramp_top' then (case when p_spec ->> 'ramp' = 'top' then 1 else 0 end)
             when 'ramp_cross' then (case when p_spec ->> 'ramp' = 'cross' then 1 else 0 end)
             else (select count(*)::integer from jsonb_array_elements(v_parts) e where e ->> 'kind' = c.part)
           end as used
      from public.pinball_part_catalog() c
      left join public.user_pinball_parts u on u.user_id = v_user_id and u.part = c.part
  loop
    if r.used > r.owned then
      raise exception using errcode = 'P0001', message = 'PARTS_SHORT', detail = r.part;
    end if;
  end loop;

  if p_id is null then
    -- 新しいステージ（1人6つまで。同じ人が同時に作っても数をこえないように）
    perform pg_advisory_xact_lock(hashtext('pinball_stage:' || v_user_id::text));
    select count(*) into v_count from public.pinball_stages where user_id = v_user_id;
    if v_count >= 6 then
      raise exception using errcode = 'P0001', message = 'STAGE_LIMIT';
    end if;
    insert into public.pinball_stages (user_id, name, spec, shared)
    values (v_user_id, v_name, p_spec, coalesce(p_shared, false))
    returning * into v_row;
  else
    select * into v_row from public.pinball_stages where id = p_id and user_id = v_user_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'STAGE_NOT_FOUND';
    end if;
    -- 名前・見た目・公開だけを変えたときは、記録を消さない
    v_layout_changed := (v_row.spec -> 'parts') is distinct from v_parts
      or (v_row.spec -> 'items') is distinct from v_items
      or (v_row.spec ->> 'ramp') is distinct from (p_spec ->> 'ramp');
    update public.pinball_stages
       set name = v_name,
           spec = p_spec,
           shared = coalesce(p_shared, false),
           updated_at = now(),
           -- clock_timestamp：同じトランザクションの中で記録したプレイ（played_at = now()）より、かならずあとにする
           layout_updated_at = case when v_layout_changed then clock_timestamp() else layout_updated_at end
     where id = p_id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'name', v_row.name,
    'shared', v_row.shared,
    'layout_changed', v_layout_changed,
    'updated_at', v_row.updated_at,
    'layout_updated_at', v_row.layout_updated_at
  );
end;
$$;

revoke all on function public.save_pinball_stage(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.save_pinball_stage(uuid, text, jsonb, boolean) to authenticated;

comment on function public.save_pinball_stage(uuid, text, jsonb, boolean) is
  'ご当地ピンボールのステージを保存する（p_id が null なら新しく作る。1人6つまで）。持っている部品をこえると PARTS_SHORT。';

commit;
