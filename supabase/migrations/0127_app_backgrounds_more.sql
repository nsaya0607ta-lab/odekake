-- =============================================================
-- ショップ：背景を8つ追加する（動く背景4つ・シンプルアート4つ）
-- =============================================================
-- 0123 の後に適用する。アプリ側の src/lib/app-backgrounds.ts の APP_BACKGROUNDS と同じ値段にする。
-- ・動く背景（4,000）：花火大会（fireworks）・紙ひこうき（paper-planes）・雲の上（cloud-sea）・わんこパレード（dog-parade）
-- ・シンプルアート（3,000）：グラデーションメッシュ（mesh）・ホログラム（holo）・すりガラス（glass）・墨と金箔（sumi）
-- 買う・選ぶ関数（buy_app_background / set_app_background）は、この値段の関数を見るので、作り直さなくてよい。
begin;

do $$
begin
  if to_regprocedure('public.app_background_price(text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'APP_BACKGROUNDS_MORE_MISSING_DEPENDENCY',
      hint = 'ショップの背景（0122・0123）を先に適用してください。';
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
    when 'fireworks' then 4000
    when 'paper-planes' then 4000
    when 'cloud-sea' then 4000
    when 'dog-parade' then 4000
    when 'mesh' then 3000
    when 'holo' then 3000
    when 'glass' then 3000
    when 'sumi' then 3000
    else null
  end;
$$;

commit;

notify pgrst, 'reload schema';
