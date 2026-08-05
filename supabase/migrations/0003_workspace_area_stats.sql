-- =============================================================
-- おでかけ記録アプリ 追加スキーマ（第3版）
-- =============================================================
-- 0001 / 0002 を適用済みのプロジェクトに対して実行してください。
--
-- 「旅ワークスペース」への対応
--   自分の旅と、共有旅それぞれを独立した空間として扱えるように、
--   地域ごとの集計を旅行単位で絞り込めるようにします。
--
--   area_stats()                 … これまでどおり、見えるすべての記録を集計
--   area_stats(array[...uuid])   … 指定した旅行の記録だけを集計
--
-- あわせて、将来の色分け（訪問回数・お気に入り数による濃淡）のために
-- お気に入り数を返すようにしています。
-- =============================================================

-- 戻り値の列が増えるため、いったん削除してから作り直す
drop function if exists public.area_stats();
drop function if exists public.area_stats(uuid[]);

create function public.area_stats(p_trip_ids uuid[] default null)
returns table (
  prefecture_code text,
  municipality_code text,
  spot_count bigint,
  visit_count bigint,
  favorite_count bigint,
  last_visited_at date
)
language sql
security invoker
stable
set search_path = public
as $$
  select s.prefecture_code,
         s.municipality_code,
         count(distinct s.id) as spot_count,
         count(vr.id) as visit_count,
         count(*) filter (where vr.favorite) as favorite_count,
         max(vr.visited_at) as last_visited_at
  from public.visit_records vr
  join public.spots s on s.id = vr.spot_id
  where p_trip_ids is null or vr.trip_id = any (p_trip_ids)
  group by s.prefecture_code, s.municipality_code;
$$;

comment on function public.area_stats(uuid[]) is
  '地域ごとの集計。p_trip_ids を渡すとその旅行の記録だけを集計する（旅ワークスペースの分離に使う）。security invoker なので RLS はそのまま効く。';

grant execute on function public.area_stats(uuid[]) to authenticated;
