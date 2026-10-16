-- 道路をふやす（ユーザー指定：道路系の種類をふやし、クオリティを上げ、おかしいところを直す）。0145 の後に適用する。
-- 1. 踏切（crossing）：まっすぐな線路に道路を直角に通す（またはその逆）と、そのマスが踏切になる。白コイン90枚。
--    車と人は道路として、列車は線路として通る。踏切は自分の向きにしかつながらない（車が線路ぞいに走ったり、
--    列車が道路へ曲がったりしない）。向きの決め方は src/lib/games/town-builder.ts の crossingAxis と同じ。
--    建物の「道路の隣」の判定、人口クエスト、駅をつなぐクエストも踏切を数える。
begin;

-- The way the railway runs through a level crossing: where the track carries on beside it, else across the road.
-- Kept in step with crossingAxis in src/lib/games/town-builder.ts.
create or replace function public.town_crossing_axis(p_tiles jsonb,p_i integer)
returns text language sql immutable set search_path=public as $$
  select case when
    (case when p_i>=24 then case when p_tiles->>(p_i-24) in ('rail','station') then 2 when p_tiles->>(p_i-24)='road' then -2 else 0 end else 0 end)
    +(case when p_i<552 then case when p_tiles->>(p_i+24) in ('rail','station') then 2 when p_tiles->>(p_i+24)='road' then -2 else 0 end else 0 end)
    >(case when p_i%24>0 then case when p_tiles->>(p_i-1) in ('rail','station') then 2 when p_tiles->>(p_i-1)='road' then -2 else 0 end else 0 end)
    +(case when p_i%24<23 then case when p_tiles->>(p_i+1) in ('rail','station') then 2 when p_tiles->>(p_i+1)='road' then -2 else 0 end else 0 end)
  then 'y' else 'x' end
$$;
revoke all on function public.town_crossing_axis(jsonb,integer) from public,anon,authenticated;

-- Validate all geometry and compute the price of additions using the database catalog (crossings: 90).
create or replace function public.town_construction_cost(p_before jsonb,p_after jsonb,p_import boolean default false)
returns integer language plpgsql set search_path=public as $$
declare
  v_cost integer:=0; i integer; j integer; k integer; x integer; y integer; w integer; h integer; n integer;
  t text; b text; l integer; old_l integer; lot jsonb; old_lot jsonb; v_part jsonb; a jsonb; old_a jsonb; info record;
  used integer[]:='{}'; keys text[]; key text; id integer; covered integer[]:='{}'; homes integer:=0;
begin
  if p_after is null or jsonb_typeof(p_after) <> 'object' or octet_length(p_after::text)>131072
    or jsonb_typeof(p_after->'tiles') is distinct from 'array' or jsonb_array_length(p_after->'tiles')<>576
    or jsonb_typeof(p_after->'levels') is distinct from 'array' or jsonb_array_length(p_after->'levels')<>576
    or jsonb_typeof(p_after->'terrain') is distinct from 'array' or jsonb_array_length(p_after->'terrain')<>576
    or jsonb_typeof(p_after->'parks') is distinct from 'array' or jsonb_array_length(p_after->'parks')>144
    or jsonb_typeof(p_after->'attachments') is distinct from 'array' or jsonb_array_length(p_after->'attachments')>576
    or jsonb_typeof(p_after->'day') is distinct from 'number' or coalesce(p_after->>'day','')!~'^[0-9]{1,10}$' or (p_after->>'day')::bigint not between 1 and 1000000000
    or jsonb_typeof(p_after->'paused') is distinct from 'boolean'
    or (p_before is not null and p_before->'terrain' is distinct from p_after->'terrain') then raise exception 'INVALID_TOWN'; end if;
  for i in 0..575 loop
    t:=p_after->'tiles'->>i; b:=coalesce(p_before->'tiles'->>i,'grass');
    if t is null or t not in ('grass','water','road','rail','station','house','shop','factory','park','home','crossing')
       or jsonb_typeof(p_after->'levels'->i) is distinct from 'number' or coalesce(p_after->'levels'->>i,'') !~ '^[0-3]$' or jsonb_typeof(p_after->'terrain'->i) is distinct from 'boolean' then raise exception 'INVALID_TOWN'; end if;
    l:=(p_after->'levels'->>i)::integer;
    if (t in ('house','shop','factory') and l=0) or (t not in ('house','shop','factory') and l<>0) then raise exception 'INVALID_TOWN'; end if;
    if (p_after->'terrain'->>i)::boolean and t not in ('water','road','rail') then raise exception 'INVALID_TOWN'; end if;
    if not (p_after->'terrain'->>i)::boolean and t='water' then raise exception 'INVALID_TOWN'; end if;
    if t='home' then homes:=homes+1; end if;
    if t in ('house','shop','factory','home') and (t<>b or l>coalesce((p_before->'levels'->>i)::integer,0)) and not p_import then
      if not ((i%24>0 and p_after->'tiles'->>(i-1) in ('road','crossing')) or (i%24<23 and p_after->'tiles'->>(i+1) in ('road','crossing')) or (i>=24 and p_after->'tiles'->>(i-24) in ('road','crossing')) or (i<552 and p_after->'tiles'->>(i+24) in ('road','crossing'))) then raise exception 'TOWN_ROAD_REQUIRED'; end if;
    end if;
    if t<>b then
      v_cost:=v_cost+case t when 'road' then case when (p_after->'terrain'->>i)::boolean then 120 else 35 end when 'rail' then case when (p_after->'terrain'->>i)::boolean then 160 else 55 end when 'crossing' then 90 when 'station' then 550 when 'house' then 250 when 'shop' then 400 when 'factory' then 650 when 'home' then 500 else 0 end;
    end if;
    if t in ('house','shop','factory') then
      old_l:=case when t=b then coalesce((p_before->'levels'->>i)::integer,1) else 1 end;
      if l>old_l then for j in old_l..l-1 loop v_cost:=v_cost+j*450; end loop; end if;
    end if;
  end loop;
  for lot in select value from jsonb_array_elements(p_after->'parks') loop
    if jsonb_typeof(lot) <> 'object' then raise exception 'INVALID_TOWN'; end if;
    if exists(select 1 from unnest(array['id','x','y','width','height']) f where jsonb_typeof(lot->f) is distinct from 'number' or coalesce(lot->>f,'')!~'^[0-9]{1,3}$') then raise exception 'INVALID_TOWN'; end if;
    x:=(lot->>'x')::integer; y:=(lot->>'y')::integer; w:=(lot->>'width')::integer; h:=(lot->>'height')::integer; id:=(lot->>'id')::integer;
    select value into old_lot from jsonb_array_elements(coalesce(p_before->'parks','[]')) where (value->>'id')::integer=id;
    if x is null or y is null or w is null or h is null or id is null or x<0 or y<0 or x+w>24 or y+h>24 or id<>y*24+x or id=any(used)
      or not ((w=2 and h=2) or (w=3 and h=3) or (w=4 and h=3) or (w=3 and h=4) or (w=1 and h=1 and (p_import or old_lot is not null)))
      or coalesce(lot->>'kind','') not in ('park','plaza') or jsonb_typeof(lot->'parts') is distinct from 'array' or jsonb_array_length(lot->'parts')>w*h*2 then raise exception 'INVALID_TOWN'; end if;
    used:=array_append(used,id);
    for j in 0..h-1 loop for k in 0..w-1 loop
      i:=(y+j)*24+x+k;
      if i=any(covered) or p_after->'tiles'->>i<>'park' or (p_after->'terrain'->>i)::boolean then raise exception 'INVALID_TOWN'; end if;
      covered:=array_append(covered,i);
    end loop; end loop;
    v_cost:=v_cost+greatest(0,public.town_lot_price(lot)-coalesce(public.town_lot_price(old_lot),0));
    keys:='{}';
    for v_part in select value from jsonb_array_elements(lot->'parts') loop
      select * into info from public.town_part_catalog() c where c.scope='park' and c.part=v_part->>'kind';
      if not found then raise exception 'INVALID_TOWN'; end if;
      if jsonb_typeof(v_part->'tile') is distinct from 'number' or coalesce(v_part->>'tile','')!~'^[0-9]{1,3}$' or jsonb_typeof(v_part->'rotation') is distinct from 'number' then raise exception 'INVALID_TOWN'; end if;
      i:=(v_part->>'tile')::integer;
      key:=i::text||':'||info.layer;
      if i is null or i%24<x or i%24>=x+w or i/24<y or i/24>=y+h or coalesce(v_part->>'rotation','')!~'^[0-3]$' or key=any(keys) then raise exception 'INVALID_TOWN'; end if;
      keys:=array_append(keys,key);
      if not exists(select 1 from jsonb_array_elements(coalesce(old_lot->'parts','[]')) e where e->>'kind'=v_part->>'kind' and e->>'tile'=v_part->>'tile') then v_cost:=v_cost+info.price; end if;
    end loop;
  end loop;
  if exists(select 1 from generate_series(0,575) series(cell) where p_after->'tiles'->>series.cell='park' and not series.cell=any(covered)) then raise exception 'INVALID_TOWN'; end if;
  if homes>1 then raise exception 'TOWN_HOME_LIMIT'; end if;
  used:='{}';
  for a in select value from jsonb_array_elements(p_after->'attachments') loop
    if jsonb_typeof(a->'tile') is distinct from 'number' or coalesce(a->>'tile','')!~'^[0-9]{1,3}$' then raise exception 'INVALID_TOWN'; end if;
    i:=(a->>'tile')::integer; t:=a->>'kind';
    if i is null or i not between 0 and 575 or i=any(used) or t is null or p_after->'tiles'->>i<>t or jsonb_typeof(a->'parts') is distinct from 'array' or jsonb_array_length(a->'parts')>11 then raise exception 'INVALID_TOWN'; end if;
    used:=array_append(used,i); keys:='{}';
    select value into old_a from jsonb_array_elements(coalesce(p_before->'attachments','[]')) e where (e->>'tile')::integer=i and e->>'kind'=t;
    for key in select jsonb_array_elements_text(a->'parts') loop
      select * into info from public.town_part_catalog() c where c.scope='facility' and c.part=key;
      if not found or not t=any(info.kinds) or key=any(keys) then raise exception 'INVALID_TOWN'; end if;
      keys:=array_append(keys,key);
      if not coalesce(old_a->'parts','[]') ? key then v_cost:=v_cost+info.price; end if;
    end loop;
  end loop;
  return v_cost;
end $$;
revoke all on function public.town_construction_cost(jsonb,jsonb,boolean) from public,anon,authenticated;

-- Quest metrics: homes beside a crossing are on a road; trains run through crossings along the track.
create or replace function public.town_quest_metric(p_town jsonb,p_id text)
returns integer language plpgsql stable set search_path=public as $$
declare v_count integer:=0; i integer; t text; extras integer; lot jsonb; stations integer[]; start_i integer; current_i integer; queue integer[]; seen integer[]; n integer; linked integer[]:='{}';
begin
  if p_town is null then return 0; end if;
  if p_id in ('roads','homes','shop','rails','factory') then
    select count(*) into v_count from jsonb_array_elements_text(p_town->'tiles') e where e=case p_id when 'roads' then 'road' when 'homes' then 'house' when 'shop' then 'shop' when 'rails' then 'rail' else 'factory' end;
  elsif p_id in ('park','green') then
    for lot in select value from jsonb_array_elements(p_town->'parks') loop
      if exists(select 1 from jsonb_array_elements(lot->'parts') e join public.town_part_catalog() c on c.scope='park' and c.part=e->>'kind' where c.value>=2) then v_count:=v_count+1; end if;
    end loop;
  elsif p_id='parts' then select coalesce(sum(jsonb_array_length(e->'parts')),0) into v_count from jsonb_array_elements(p_town->'parks') e;
  elsif p_id='equipment' then select coalesce(sum(jsonb_array_length(e->'parts')),0) into v_count from jsonb_array_elements(p_town->'attachments') e;
  elsif p_id='variety' then select count(distinct p->>'kind') into v_count from jsonb_array_elements(p_town->'parks') l cross join lateral jsonb_array_elements(l->'parts') p;
  elsif p_id in ('upgrade','skyline','master') then
    select count(*) into v_count from generate_series(0,575) idx(cell) where p_town->'tiles'->>idx.cell in ('house','shop','factory') and (p_town->'levels'->>idx.cell)::integer>=case when p_id='upgrade' then 2 else 3 end;
  elsif p_id in ('people','residents','city','metropolis') then
    for i in 0..575 loop
      if p_town->'tiles'->>i='house' and ((i%24>0 and p_town->'tiles'->>(i-1) in ('road','crossing')) or (i%24<23 and p_town->'tiles'->>(i+1) in ('road','crossing')) or (i>=24 and p_town->'tiles'->>(i-24) in ('road','crossing')) or (i<552 and p_town->'tiles'->>(i+24) in ('road','crossing'))) then
        select count(*)*6 into extras from jsonb_array_elements(p_town->'attachments') a where (a->>'tile')::integer=i and a->'parts' ? 'terrace';
        v_count:=v_count+(p_town->'levels'->>i)::integer*18+extras;
      end if;
    end loop;
  elsif p_id='railway' then
    select array_agg(idx.cell) into stations from generate_series(0,575) idx(cell) where p_town->'tiles'->>idx.cell='station';
    foreach start_i in array coalesce(stations,'{}') loop
      queue:=array[start_i]; seen:=queue;
      while cardinality(queue)>0 loop
        current_i:=queue[1]; queue:=queue[2:];
        for n in select q from unnest(array[case when current_i%24>0 then current_i-1 end,case when current_i%24<23 then current_i+1 end,case when current_i>=24 then current_i-24 end,case when current_i<552 then current_i+24 end]) q where q is not null loop
          if n=any(seen) then continue; end if;
          t:=p_town->'tiles'->>n;
          if t not in ('rail','station','crossing') then continue; end if;
          -- A level crossing carries trains only along its railway, never down the road.
          if (t='crossing' and public.town_crossing_axis(p_town->'tiles',n)<>case when abs(n-current_i)=1 then 'x' else 'y' end)
            or (p_town->'tiles'->>current_i='crossing' and public.town_crossing_axis(p_town->'tiles',current_i)<>case when abs(n-current_i)=1 then 'x' else 'y' end) then continue; end if;
          seen:=array_append(seen,n);
          if t='station' then
            if current_i<>start_i then linked:=array_append(array_append(linked,start_i),n); end if;
          else queue:=array_append(queue,n); end if;
        end loop;
      end loop;
    end loop;
    select count(distinct q) into v_count from unnest(linked) q;
  end if;
  return v_count;
end $$;
revoke all on function public.town_quest_metric(jsonb,text) from public,anon,authenticated;

notify pgrst, 'reload schema';
commit;
