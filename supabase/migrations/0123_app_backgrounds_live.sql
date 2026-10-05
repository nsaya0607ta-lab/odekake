-- =============================================================
-- ショップ：動く背景・変わる背景を8つ追加する
-- =============================================================
-- 0122 の後に適用する。値段（青コイン）は、これまでの「動く・時間で変わる」背景と同じ 4,000。
-- ・動く背景：わんこの足あと（paw-trail）・シャボン玉（bubbles）・きんぎょの池（goldfish）・
--   とろけるゼリー（jelly）・オーロラの夜（aurora-night）
-- ・変わる背景：おそとの天気（weather）・歩いて咲く花畑（garden）・四季めぐり（seasons）
-- アプリ側の src/lib/app-backgrounds.ts の APP_BACKGROUNDS と同じにする。
-- 買う・選ぶ関数（buy_app_background / set_app_background）は、この値段の関数を見るので、作り直さなくてよい。
begin;

do $$
begin
  if to_regprocedure('public.app_background_price(text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'APP_BACKGROUNDS_LIVE_MISSING_DEPENDENCY',
      hint = 'ショップの背景（0122）を先に適用してください。';
  end if;
end;
$$;

/** 背景の値段（青コイン）。「いつもの」は 0、知らない背景は null */
create or replace function public.app_background_price(p_background text)
returns integer
language sql
immutable
as $$
  select case p_background
    when 'default' then 0
    when 'paw' then 1500
    when 'washi' then 1500
    when 'watercolor' then 1500
    when 'autumn' then 1500
    when 'map' then 2500
    when 'scenery' then 2500
    when 'starry' then 2500
    when 'aurora' then 4000
    when 'sky-clock' then 4000
    when 'paw-trail' then 4000
    when 'bubbles' then 4000
    when 'goldfish' then 4000
    when 'jelly' then 4000
    when 'aurora-night' then 4000
    when 'weather' then 4000
    when 'garden' then 4000
    when 'seasons' then 4000
    else null
  end;
$$;

commit;

notify pgrst, 'reload schema';
