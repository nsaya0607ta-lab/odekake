-- 共通の青コインと、かくれ漢字の進行を一つのトランザクションで保存する。
-- 計算は Next.js で行い、専用HMACで署名する。署名のないRPCによる残高操作は不可。
create schema if not exists kanji_private;
revoke all on schema kanji_private from public, anon, authenticated;
create table if not exists kanji_private.wallet_keys (id text primary key, secret text not null check (length(secret) >= 64));
alter table kanji_private.wallet_keys enable row level security;
revoke all on kanji_private.wallet_keys from public, anon, authenticated;

create table if not exists public.user_kakure_kanji (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save jsonb,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.kakure_kanji_receipts (
  user_id uuid not null references public.user_kakure_kanji(user_id) on delete cascade,
  request_id uuid not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.user_kakure_kanji enable row level security;
alter table public.kakure_kanji_receipts enable row level security;
drop policy if exists kakure_kanji_own on public.user_kakure_kanji;
create policy kakure_kanji_own on public.user_kakure_kanji for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists kakure_kanji_receipt_own on public.kakure_kanji_receipts;
create policy kakure_kanji_receipt_own on public.kakure_kanji_receipts for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_kakure_kanji, public.kakure_kanji_receipts from public, anon, authenticated;
grant select on public.user_kakure_kanji, public.kakure_kanji_receipts to authenticated;

alter table public.blue_coin_events drop constraint if exists blue_coin_events_event_type_check;
alter table public.blue_coin_events add constraint blue_coin_events_event_type_check check (event_type = any (array[
  'osanpo_run','room_furniture','pref_gacha','first_place','login_total','home_drop','app_background','home_skin','pinball','red_coin_convert','kakure_kanji'
])) not valid;

create or replace function public.get_kakure_kanji_receipt(p_request_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select response from public.kakure_kanji_receipts where user_id = (select auth.uid()) and request_id = p_request_id;
$$;
revoke all on function public.get_kakure_kanji_receipt(uuid) from public, anon;
grant execute on function public.get_kakure_kanji_receipt(uuid) to authenticated;

-- SECURITY DEFINER は青コイン台帳と記録を原子的に更新するためだけに使う。
-- 認証ID、サーバー署名、リビジョンを確認し、任意のユーザー・金額を受け付けない。
create or replace function kanji_private.commit_kakure_kanji(p_payload text, p_signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); p jsonb; k text; expected text; r public.user_kakure_kanji%rowtype;
  req uuid; delta integer; b integer; prior jsonb; next_save jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_payload is null or octet_length(p_payload) > 1000000 then raise exception 'INVALID_KANJI'; end if;
  p := p_payload::jsonb;
  if p->>'userId' is distinct from u::text then raise exception 'KANJI_ACCOUNT'; end if;
  select secret into k from kanji_private.wallet_keys where id = p->>'keyId';
  if k is null then raise exception 'KANJI_SIGNATURE'; end if;
  expected := encode(extensions.hmac(convert_to(p_payload,'UTF8'), convert_to(k,'UTF8'), 'sha256'),'hex');
  if p_signature is null or p_signature <> expected then raise exception 'KANJI_SIGNATURE'; end if;
  req := (p->>'requestId')::uuid; delta := (p->>'delta')::integer;
  if req is null or delta is null or abs(delta::bigint) > 1000000 or jsonb_typeof(p->'save') is distinct from 'object' or jsonb_typeof(p->'event') is distinct from 'object' then raise exception 'INVALID_KANJI'; end if;
  insert into public.user_kakure_kanji(user_id) values(u) on conflict do nothing;
  select * into r from public.user_kakure_kanji where user_id=u for update;
  select response into prior from public.kakure_kanji_receipts where user_id=u and request_id=req;
  if found then
    select balance into b from public.user_blue_coins where user_id=u;
    return jsonb_build_object('snapshot',jsonb_build_object('save',jsonb_set(r.save,'{coins}',to_jsonb(coalesce(b,0))),'revision',r.revision,'balance',coalesce(b,0)),'event',prior,'replayed',true);
  end if;
  if (p->>'revision')::integer is distinct from r.revision then raise exception 'KANJI_CONFLICT'; end if;
  insert into public.user_blue_coins(user_id) values(u) on conflict do nothing;
  select balance into b from public.user_blue_coins where user_id=u for update;
  if delta < 0 and b + delta < 0 then raise exception 'BLUE_COINS_SHORT'; end if;
  if delta <> 0 then
    perform public.add_blue_coin_event(u,'kakure_kanji',delta,'kakure-kanji:'||req::text,jsonb_build_object('label',case when delta < 0 then 'かくれ漢字のヒント' else 'かくれ漢字の報酬' end));
  end if;
  select balance into b from public.user_blue_coins where user_id=u;
  next_save := jsonb_set(p->'save','{coins}',to_jsonb(b));
  update public.user_kakure_kanji set save=next_save,revision=revision+1,updated_at=now() where user_id=u;
  insert into public.kakure_kanji_receipts(user_id,request_id,response) values(u,req,p->'event');
  return jsonb_build_object('snapshot',jsonb_build_object('save',next_save,'revision',r.revision+1,'balance',b),'event',p->'event');
end;
$$;
revoke all on function kanji_private.commit_kakure_kanji(text,text) from public, anon;
grant usage on schema kanji_private to authenticated;
grant execute on function kanji_private.commit_kakure_kanji(text,text) to authenticated;

create or replace function public.commit_kakure_kanji(p_payload text, p_signature text) returns jsonb
language sql security invoker set search_path = '' as $$
  select kanji_private.commit_kakure_kanji(p_payload,p_signature);
$$;
revoke all on function public.commit_kakure_kanji(text,text) from public, anon;
grant execute on function public.commit_kakure_kanji(text,text) to authenticated;
