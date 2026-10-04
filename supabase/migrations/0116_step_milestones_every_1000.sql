-- 歩数の達成ボーナスを、3,000歩から1,000歩ごとにする（src/lib/coins.ts の STEP_COIN_MILESTONES と同じ値）。
-- 3,000〜9,000歩は各 +100、10,000歩で +400。累計は 5,000歩で300・8,000歩で600・10,000歩で1,100 で、これまでの節目と同じ。
create or replace function public.calculate_step_coins(p_steps integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select
    (greatest(0, p_steps) / 500) * 60
    + case when p_steps >= 3000 then 100 else 0 end
    + case when p_steps >= 4000 then 100 else 0 end
    + case when p_steps >= 5000 then 100 else 0 end
    + case when p_steps >= 6000 then 100 else 0 end
    + case when p_steps >= 7000 then 100 else 0 end
    + case when p_steps >= 8000 then 100 else 0 end
    + case when p_steps >= 9000 then 100 else 0 end
    + case when p_steps >= 10000 then 400 else 0 end;
$$;

-- 今日すでに同期済みの歩数は、新ルールへその場で差分調整する（0028 と同じやり方）。
do $$
declare
  v_steps record;
begin
  for v_steps in
    select user_id, step_date, steps, source
      from public.daily_steps
     where step_date = (timezone('Asia/Tokyo', now()))::date
  loop
    perform public.set_coin_event(
      v_steps.user_id,
      'steps',
      public.calculate_step_coins(v_steps.steps),
      'steps:' || v_steps.step_date::text,
      null,
      v_steps.step_date,
      jsonb_build_object('label', '歩数コイン', 'steps', v_steps.steps, 'source', v_steps.source)
    );
  end loop;
end;
$$;
