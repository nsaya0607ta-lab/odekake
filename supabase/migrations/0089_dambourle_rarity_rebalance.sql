-- =============================================================
-- ダンボールガチャ：レアリティ再編成
-- =============================================================
-- ユーザー指定でランク構成をSSR6種/UR4種/LR2種/MR1種に変更し、No.5の基礎値も
-- 25%→50%に引き上げた（src/lib/dambourle/prizes.tsと同時に更新すること）。
--
-- 新構成:
--   SSR（排出率60%、6種・各10%）: No.5, No.6, No.7, No.8, No.9, No.13
--   UR（排出率30%、4種・各7.5%）: No.2, No.3, No.10, No.12
--   LR（排出率9.5%、2種・各4.75%）: No.1, No.4
--   MR（排出率0.5%、1種）: No.11
--
-- dambourle_duplicate_coin_for_rank / dambourle_level_cap_for_item /
-- dambourle_skin_tier_for_item はランク→数値の対応のみで変更不要。

create or replace function public.dambourle_rank_for_item(p_item_id text)
returns text
language sql
immutable
as $$
  select case p_item_id
    when 'dambourle_no5' then 'SSR'
    when 'dambourle_no6' then 'SSR'
    when 'dambourle_no7' then 'SSR'
    when 'dambourle_no8' then 'SSR'
    when 'dambourle_no9' then 'SSR'
    when 'dambourle_no13' then 'SSR'
    when 'dambourle_no2' then 'UR'
    when 'dambourle_no3' then 'UR'
    when 'dambourle_no10' then 'UR'
    when 'dambourle_no12' then 'UR'
    when 'dambourle_no1' then 'LR'
    when 'dambourle_no4' then 'LR'
    when 'dambourle_no11' then 'MR'
    else null
  end;
$$;
