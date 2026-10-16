-- まちづくりを全員に公開する（ユーザー指定）。0146 の後に適用する。
-- これまでは town_builder_access に登録したアカウント（0141 を最初に適用したときの「しゅん」）だけが遊べた。
-- 0147 からは、ログインしているアカウントならだれでも自分の街を作れる。ほかの人の街・残高を見たり変えたりできないのは同じ。
-- town_builder_access の表は消さずに残す（もう見ない）。has_town_builder_access() はログインしていれば true を返す。
-- get_town_builder・commit_town_builder は、利用できる人の確かめ（TOWN_NOT_ALLOWED）を外しただけで、ほかは 0141・0145 と同じ。
begin;

create or replace function public.has_town_builder_access()
returns boolean language sql stable security invoker set search_path=public as $$
  select auth.uid() is not null
$$;
revoke all on function public.has_town_builder_access() from public,anon;
grant execute on function public.has_town_builder_access() to authenticated;

create or replace function public.get_town_builder()
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); r public.user_town_builder%rowtype; b integer; d date:=(timezone('Asia/Tokyo',now()))::date;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.user_town_builder where user_id=u;
  select balance into b from public.user_white_coins where user_id=u;
  return jsonb_build_object('town',case when r.town is null then null else jsonb_set(r.town,'{money}',to_jsonb(coalesce(b,0))) end,'balance',coalesce(b,0),'revision',coalesce(r.revision,0),'xp',coalesce(r.xp,0),'maxLevel',coalesce(r.max_level,1),'claimedQuests',coalesce(r.claimed_quests,'{}'::text[]),'canUndo',coalesce(jsonb_array_length(r.undo)>0,false),'date',d,'dailySpent',case when r.daily_date=d then r.daily_spent else 0 end,'dailyClaimed',exists(select 1 from public.white_coin_events where user_id=u and idempotency_key='login:'||d::text),'dailyQuestClaimed',exists(select 1 from public.white_coin_events where user_id=u and idempotency_key='quest:daily:'||d::text));
end $$;
revoke all on function public.get_town_builder() from public,anon;
grant execute on function public.get_town_builder() to authenticated;

create or replace function public.commit_town_builder(p_request_id uuid,p_revision integer,p_action text,p_town jsonb default null,p_quest text default null,p_import boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); r public.user_town_builder%rowtype; cost integer:=0; gain integer:=0; lv integer; q record; prev jsonb; d date:=(timezone('Asia/Tokyo',now()))::date; entry jsonb; dummy integer;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null or p_revision is null or p_revision<0 or p_import is null or p_action is null or p_action not in ('start','edit','undo','quest','daily','reset') then raise exception 'INVALID_TOWN_ACTION'; end if;
  insert into public.user_town_builder(user_id) values(u) on conflict do nothing;
  select * into r from public.user_town_builder where user_id=u for update;
  if exists(select 1 from public.town_builder_receipts where user_id=u and request_id=p_request_id) then return public.get_town_builder(); end if;
  if r.revision<>p_revision then raise exception 'TOWN_CONFLICT'; end if;
  if p_action='reset' or (p_action='start' and not p_import) then
    if not exists(select 1 from unnest(array[true,false]) starter where
      (p_town-array['money','day','paused','rewards'])=(public.town_starter_layout(starter)-array['money','day','paused','rewards'])) then raise exception 'INVALID_TOWN_STARTER'; end if;
  end if;
  if p_action='start' then
    if r.town is not null then raise exception 'TOWN_ALREADY_STARTED'; end if;
    dummy:=public.town_construction_cost(null,p_town,true);
    r.town:=p_town;
    -- No starter grant since 0145. Reset and local save values never mint currency either.
    if p_import then
      r.xp:=least(5000,dummy/10);
      r.max_level:=public.town_level(r.xp);
    end if;
  elsif r.town is null then raise exception 'TOWN_NOT_STARTED';
  elsif p_action='edit' then
    cost:=public.town_construction_cost(r.town,p_town);
    if r.town->'tiles'=p_town->'tiles' and r.town->'levels'=p_town->'levels' and r.town->'parks'=p_town->'parks' and r.town->'attachments'=p_town->'attachments' then raise exception 'TOWN_NO_CHANGE'; end if;
    gain:=case when cost>0 then greatest(1,cost/10) else 0 end;
    if cost>0 then perform public.add_white_coin_event(u,'town_build',-cost,'town:'||p_request_id::text,jsonb_build_object('label','街の建設・部品購入','xp',gain)); end if;
    entry:=jsonb_build_object('town',r.town,'cost',cost,'xp',gain,'request',p_request_id,'date',d);
    select coalesce(jsonb_agg(e order by ord),'[]') into r.undo from jsonb_array_elements(r.undo||jsonb_build_array(entry)) with ordinality a(e,ord) where ord>greatest(0,jsonb_array_length(r.undo)+1-20);
    r.town:=p_town; r.xp:=r.xp+gain;
    r.daily_spent:=case when r.daily_date=d then r.daily_spent else 0 end+cost; r.daily_date:=d;
  elsif p_action='undo' then
    if jsonb_array_length(r.undo)=0 then raise exception 'TOWN_UNDO_EMPTY'; end if;
    entry:=r.undo->-1; cost:=(entry->>'cost')::integer;
    if cost>0 then perform public.add_white_coin_event(u,'town_undo',cost,'undo:'||(entry->>'request'),jsonb_build_object('label','工事の取り消し')); end if;
    r.town:=entry->'town'; r.xp:=greatest(0,r.xp-(entry->>'xp')::integer); r.undo:=r.undo-(jsonb_array_length(r.undo)-1);
    if r.daily_date=d and entry->>'date'=d::text then r.daily_spent:=greatest(0,r.daily_spent-cost); end if;
  elsif p_action='reset' then
    dummy:=public.town_construction_cost(null,p_town,true); r.town:=p_town; r.undo:='[]';
  elsif p_action='daily' then perform public.claim_white_login_bonus();
  elsif p_action='quest' then
    if p_quest='daily' then
      if r.daily_date is distinct from d or r.daily_spent<500 then raise exception 'TOWN_QUEST_NOT_READY'; end if;
      if public.add_white_coin_event(u,'quest',250,'quest:daily:'||d::text,jsonb_build_object('label','今日の開拓クエスト')) then r.xp:=r.xp+50; end if;
    else
      select * into q from public.town_quest_catalog() c where c.id=p_quest;
      if not found or public.town_level(r.xp)<q.level or public.town_quest_metric(r.town,p_quest)<q.target then raise exception 'TOWN_QUEST_NOT_READY'; end if;
      if not p_quest=any(r.claimed_quests) then
        perform public.add_white_coin_event(u,'quest',q.coins,'quest:'||p_quest,jsonb_build_object('label',q.title||' 達成報酬'));
        r.xp:=r.xp+q.xp; r.claimed_quests:=array_append(r.claimed_quests,p_quest);
      end if;
    end if;
  end if;
  lv:=public.town_level(r.xp);
  if lv>r.max_level then
    for dummy in r.max_level+1..lv loop
      perform public.add_white_coin_event(u,'level_up',200+dummy*50,'town-level:'||dummy::text,jsonb_build_object('label','まちづくりLv.'||dummy::text||' 報酬'));
    end loop;
    r.max_level:=lv;
  end if;
  update public.user_town_builder set town=r.town,revision=r.revision+1,xp=r.xp,max_level=r.max_level,claimed_quests=r.claimed_quests,undo=r.undo,daily_date=r.daily_date,daily_spent=r.daily_spent,updated_at=now() where user_id=u;
  insert into public.town_builder_receipts(user_id,request_id,revision) values(u,p_request_id,r.revision+1);
  return public.get_town_builder();
end $$;
revoke all on function public.commit_town_builder(uuid,integer,text,jsonb,text,boolean) from public,anon;
grant execute on function public.commit_town_builder(uuid,integer,text,jsonb,text,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
