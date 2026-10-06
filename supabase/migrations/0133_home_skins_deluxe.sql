-- =============================================================
-- ホームのカードの絵がらに「豪華」（deluxe）を足す
-- =============================================================
-- 0132 の後に適用する。アプリ側の src/lib/home-skins.ts と同じ値段にする。
-- ・豪華：わんこのカード 2,000／ほかは 1,000（冬は 1,500／800 のまま）
begin;

create or replace function public.home_skin_price(p_theme text, p_part text)
returns integer
language sql
immutable
as $$
  select case
    when p_part not in ('scene', 'notice', 'highlights', 'collection') then null
    when p_theme = 'default' then 0
    when p_theme = 'winter' then case p_part when 'scene' then 1500 else 800 end
    when p_theme = 'deluxe' then case p_part when 'scene' then 2000 else 1000 end
    else null
  end;
$$;

commit;

notify pgrst, 'reload schema';
