-- =============================================================
-- 歩数EXPの報酬テーブルを調整
-- =============================================================
-- 1日の歩数に応じて、段階的にEXPを付与する。
-- 同日に複数回同期した場合は、daily_steps / exp_events が更新されるため重複加算しない。

create or replace function public.calculate_step_exp(p_steps integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case
    when p_steps >= 20000 then 1000
    when p_steps >= 15000 then 750
    when p_steps >= 12000 then 550
    when p_steps >= 10000 then 420
    when p_steps >= 9000 then 350
    when p_steps >= 8000 then 300
    when p_steps >= 7000 then 250
    when p_steps >= 6000 then 210
    when p_steps >= 5000 then 170
    when p_steps >= 4000 then 120
    when p_steps >= 3000 then 80
    when p_steps >= 2000 then 50
    when p_steps >= 1000 then 25
    else 0
  end;
$$;
