-- =============================================================
-- ショップ：背景を9つ追加する
-- =============================================================
-- 0127 の後に適用する。アプリ側の src/lib/app-backgrounds.ts の APP_BACKGROUNDS と同じ値段にする。
-- ・動く背景（4,000）：ふうせん（balloons）・ローカル線（local-train）
-- ・なぞる背景（4,000）：枯山水（zen-sand）・ほたるの川辺（fireflies）・にじむ絵の具（paint-bloom）
-- ・かたむける背景（4,000）：ビー玉（marbles）・スノードーム（snow-globe）
-- ・記録で育つ背景（5,000）：あなたの日本地図（my-map）・おでかけ星図（my-stars）
begin;

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
    when 'balloons' then 4000
    when 'local-train' then 4000
    when 'zen-sand' then 4000
    when 'fireflies' then 4000
    when 'paint-bloom' then 4000
    when 'marbles' then 4000
    when 'snow-globe' then 4000
    when 'my-map' then 5000
    when 'my-stars' then 5000
    else null
  end;
$$;

commit;

notify pgrst, 'reload schema';
