-- =============================================================
-- 歩数コインを「500歩ごとに10コイン」へ変更
-- =============================================================

create or replace function public.calculate_step_coins(p_steps integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select (greatest(0, p_steps) / 500) * 10;
$$;

-- すでに今日の歩数を同期済みの場合も、新ルールへ即時に合わせる。
-- coin_events_sync_balance トリガーにより、差額だけ残高へ反映される。
update public.coin_events ce
   set amount = public.calculate_step_coins(ds.steps),
       metadata = coalesce(ce.metadata, '{}'::jsonb) || jsonb_build_object(
         'label', '歩数コイン',
         'steps', ds.steps,
         'rule', '500歩ごとに10コイン'
       ),
       updated_at = now()
  from public.daily_steps ds
 where ce.user_id = ds.user_id
   and ce.event_type = 'steps'
   and ce.idempotency_key = 'steps:' || ds.step_date::text
   and ds.step_date = (timezone('Asia/Tokyo', now()))::date;
