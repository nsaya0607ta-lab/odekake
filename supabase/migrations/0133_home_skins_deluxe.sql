-- =============================================================
-- ホームのカードの絵がらに「豪華」（deluxe）を足す
-- =============================================================
-- 0132 の後に適用する。アプリ側の src/lib/home-skins.ts と同じ値段にする。
-- ・豪華：冬と同じ（わんこのカード 1,500／ほかは 800）
begin;

create or replace function public.home_skin_price(p_theme text, p_part text)
returns integer
language sql
immutable
as $$
  select case
    when p_part not in ('scene', 'notice', 'highlights', 'collection') then null
    when p_theme = 'default' then 0
    when p_theme in ('winter', 'deluxe') then case p_part when 'scene' then 1500 else 800 end
    else null
  end;
$$;

commit;

notify pgrst, 'reload schema';
