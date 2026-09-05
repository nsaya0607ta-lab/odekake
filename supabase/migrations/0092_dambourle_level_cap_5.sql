-- =============================================================
-- ダンボールガチャ：Lv上限を全ランク5に統一
-- =============================================================
-- ユーザー指定で、ダンボール自身のLv上限をSSR/UR/LR/MR全ランク共通の5に変更
-- （旧: SSR/UR/LR=70, MR=5）。あわせてLvアップに必要な重複数も3個→5個に変更。
-- クライアント側は src/lib/dambourle/skill-levels.ts / config.ts と同時に更新すること。
--
-- スキン解放は、No.11(MR)は元からLvがそのままスキン段階(1〜5)。
-- No.11以外は「Lv1は基本スキン(0)のまま、Lv2〜5でスキン2〜5が1枚ずつ解放」
-- （スキン1はスキン0と同一画像のため使わない。skin-1.webpは削除済み）。
-- 権限チェック(set_dambourle_equipped)は範囲チェックのみなので、
-- 「Lvがそのまま上限」という単純な式(least(p_level, 5))に統一してよい
-- （スキン1を許可してしまっても実害はない＝スキン0と同一画像のため）。

create or replace function public.dambourle_level_cap_for_item(p_item_id text)
returns integer
language sql
immutable
as $$
  select 5;
$$;

create or replace function public.dambourle_level_for_count(p_item_id text, p_count integer)
returns integer
language sql
immutable
as $$
  select least(
    public.dambourle_level_cap_for_item(p_item_id),
    floor((greatest(p_count, 1) - 1) / 5.0)::integer + 1
  );
$$;

create or replace function public.dambourle_skin_tier_for_item(p_item_id text, p_level integer)
returns integer
language sql
immutable
as $$
  select least(p_level, 5);
$$;
