-- VEYORA FINAL REAL MATCHMAKING + WEBRTC SIGNALING
create extension if not exists pgcrypto;

create table if not exists public.match_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null default 'all',
  status text not null default 'waiting',
  matched_with uuid references auth.users(id) on delete set null,
  match_id uuid,
  joined_at timestamptz not null default now()
);

-- Make an older match_queue table compatible with this build.
alter table public.match_queue add column if not exists country text not null default 'all';
alter table public.match_queue add column if not exists status text not null default 'waiting';
alter table public.match_queue add column if not exists matched_with uuid references auth.users(id) on delete set null;
alter table public.match_queue add column if not exists match_id uuid;
alter table public.match_queue add column if not exists joined_at timestamptz not null default now();

create unique index if not exists match_queue_one_active_per_user
on public.match_queue(user_id)
where status in ('waiting','matched');

create table if not exists public.video_signals (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.match_queue enable row level security;
alter table public.video_signals enable row level security;

drop policy if exists "match queue select authenticated" on public.match_queue;
drop policy if exists "match queue insert own" on public.match_queue;
drop policy if exists "match queue update own or claim waiting" on public.match_queue;
drop policy if exists "match queue delete own" on public.match_queue;

create policy "match queue select authenticated"
on public.match_queue for select to authenticated using (true);

create policy "match queue insert own"
on public.match_queue for insert to authenticated
with check (auth.uid() = user_id);

create policy "match queue update own or claim waiting"
on public.match_queue for update to authenticated
using (auth.uid() = user_id or status = 'waiting')
with check (auth.uid() = user_id or status = 'matched');

create policy "match queue delete own"
on public.match_queue for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "video signals select participants" on public.video_signals;
drop policy if exists "video signals insert sender" on public.video_signals;
drop policy if exists "video signals delete participants" on public.video_signals;

create policy "video signals select participants"
on public.video_signals for select to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "video signals insert sender"
on public.video_signals for insert to authenticated
with check (auth.uid() = sender_id);

create policy "video signals delete participants"
on public.video_signals for delete to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

grant select, insert, update, delete on public.match_queue to authenticated;
grant select, insert, delete on public.video_signals to authenticated;

-- Atomic matchmaking. This prevents two phones from selecting the same waiting
-- person and then both getting stuck in Searching...
drop function if exists public.veyora_find_match(uuid,text);
create or replace function public.veyora_find_match(p_user_id uuid, p_country text)
returns table(queue_id uuid, matched_user_id uuid, match_id uuid, matched_country text)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  new_match uuid := gen_random_uuid();
  mine uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;

  -- Remove only this user's old queue rows. A previous matched session must
  -- never block the user from starting a new chat.
  delete from public.match_queue where user_id = p_user_id;

  -- Lock one compatible waiting row so two users cannot claim it at once.
  select mq.id, mq.user_id, mq.country
    into candidate
  from public.match_queue mq
  where mq.status = 'waiting'
    and mq.user_id <> p_user_id
    and (coalesce(p_country,'all') = 'all'
         or coalesce(mq.country,'all') = 'all'
         or mq.country = p_country)
  order by mq.joined_at asc
  for update skip locked
  limit 1;

  if found then
    update public.match_queue
       set status = 'matched', matched_with = p_user_id, match_id = new_match
     where id = candidate.id;

    insert into public.match_queue(user_id,country,status,matched_with,match_id)
    values(p_user_id,coalesce(p_country,'all'),'matched',candidate.user_id,new_match)
    returning id into mine;

    return query select mine, candidate.user_id, new_match, candidate.country;
  else
    insert into public.match_queue(user_id,country,status)
    values(p_user_id,coalesce(p_country,'all'),'waiting')
    returning id into mine;

    return query select mine, null::uuid, null::uuid, null::text;
  end if;
end;
$$;

grant execute on function public.veyora_find_match(uuid,text) to authenticated;


-- ============================================================
-- VEYORA SAFETY + ADMIN SECURITY (run after the core schema)
-- ============================================================
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id),
  check(blocker_id <> blocked_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  match_id uuid,
  status text not null default 'pending' check(status in ('pending','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references auth.users(id) on delete set null
);

create table if not exists public.user_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.user_suspensions enable row level security;
alter table public.admin_users enable row level security;

-- Normal users may only see/manage their own blocks. Reports, suspensions,
-- and admin membership are deliberately not directly readable by clients.
drop policy if exists "blocks own select" on public.user_blocks;
drop policy if exists "blocks own insert" on public.user_blocks;
drop policy if exists "blocks own delete" on public.user_blocks;
create policy "blocks own select" on public.user_blocks for select to authenticated using(auth.uid()=blocker_id);
create policy "blocks own insert" on public.user_blocks for insert to authenticated with check(auth.uid()=blocker_id);
create policy "blocks own delete" on public.user_blocks for delete to authenticated using(auth.uid()=blocker_id);

drop policy if exists "reports no direct select" on public.user_reports;
drop policy if exists "reports no direct insert" on public.user_reports;
-- Reports are written through the security-definer RPC below.

-- One secure operation for the client: report + block atomically.
drop function if exists public.veyora_report_and_block(uuid,text,uuid);
create or replace function public.veyora_report_and_block(p_reported_id uuid,p_reason text,p_match_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare rid uuid;
begin
  if auth.uid() is null or p_reported_id is null or p_reported_id=auth.uid() then
    raise exception 'Invalid report';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 or length(trim(p_reason)) > 120 then
    raise exception 'Invalid report reason';
  end if;
  insert into public.user_blocks(blocker_id,blocked_id)
  values(auth.uid(),p_reported_id)
  on conflict(blocker_id,blocked_id) do nothing;
  insert into public.user_reports(reporter_id,reported_id,reason,match_id)
  values(auth.uid(),p_reported_id,trim(p_reason),p_match_id)
  returning id into rid;
  return rid;
end;
$$;
grant execute on function public.veyora_report_and_block(uuid,text,uuid) to authenticated;

-- Admin check is intentionally isolated from client-readable tables.
drop function if exists public.veyora_is_admin();
create or replace function public.veyora_is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.admin_users where user_id=auth.uid()); $$;
grant execute on function public.veyora_is_admin() to authenticated;

-- Replace the matchmaking function so blocked/suspended accounts are skipped.
drop function if exists public.veyora_find_match(uuid,text);
create or replace function public.veyora_find_match(p_user_id uuid, p_country text)
returns table(queue_id uuid, matched_user_id uuid, match_id uuid, matched_country text)
language plpgsql security definer set search_path=public
as $$
declare candidate record; new_match uuid:=gen_random_uuid(); mine uuid;
begin
  if auth.uid() is null or auth.uid()<>p_user_id then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.user_suspensions where user_id=p_user_id and active) then raise exception 'Account unavailable'; end if;
  delete from public.match_queue where user_id=p_user_id;
  select mq.id,mq.user_id,mq.country into candidate
  from public.match_queue mq
  where mq.status='waiting' and mq.user_id<>p_user_id
    and (coalesce(p_country,'all')='all' or coalesce(mq.country,'all')='all' or mq.country=p_country)
    and not exists(select 1 from public.user_blocks b where b.blocker_id=p_user_id and b.blocked_id=mq.user_id)
    and not exists(select 1 from public.user_blocks b where b.blocker_id=mq.user_id and b.blocked_id=p_user_id)
    and not exists(select 1 from public.user_suspensions s where s.user_id=mq.user_id and s.active)
  order by mq.joined_at asc for update skip locked limit 1;
  if found then
    update public.match_queue set status='matched',matched_with=p_user_id,match_id=new_match where id=candidate.id;
    insert into public.match_queue(user_id,country,status,matched_with,match_id)
    values(p_user_id,coalesce(p_country,'all'),'matched',candidate.user_id,new_match) returning id into mine;
    return query select mine,candidate.user_id,new_match,candidate.country;
  else
    insert into public.match_queue(user_id,country,status) values(p_user_id,coalesce(p_country,'all'),'waiting') returning id into mine;
    return query select mine,null::uuid,null::uuid,null::text;
  end if;
end;
$$;
grant execute on function public.veyora_find_match(uuid,text) to authenticated;

-- Admin-only RPCs. These are the only way the admin page reads moderation data.
drop function if exists public.veyora_admin_summary();
create or replace function public.veyora_admin_summary()
returns jsonb language plpgsql security definer set search_path=public
as $$
declare out jsonb;
begin
  if not public.veyora_is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'users',(select count(*) from auth.users),
    'online',(select count(*) from public.profiles where coalesce(online,false)=true),
    'pending_reports',(select count(*) from public.user_reports where status='pending'),
    'blocked_pairs',(select count(*) from public.user_blocks),
    'suspended',(select count(*) from public.user_suspensions where active)
  ) into out;
  return out;
end;
$$;
grant execute on function public.veyora_admin_summary() to authenticated;

drop function if exists public.veyora_admin_reports();
create or replace function public.veyora_admin_reports()
returns table(id uuid,reporter_id uuid,reporter_email text,reported_id uuid,reported_email text,reason text,match_id uuid,status text,created_at timestamptz)
language plpgsql security definer set search_path=public
as $$
begin
  if not public.veyora_is_admin() then raise exception 'Admin access required'; end if;
  return query
  select r.id,r.reporter_id,ru.email::text,r.reported_id,tu.email::text,r.reason,r.match_id,r.status,r.created_at
  from public.user_reports r
  left join auth.users ru on ru.id=r.reporter_id
  left join auth.users tu on tu.id=r.reported_id
  order by r.created_at desc limit 200;
end;
$$;
grant execute on function public.veyora_admin_reports() to authenticated;

drop function if exists public.veyora_admin_set_status(uuid,text);
create or replace function public.veyora_admin_set_status(p_report_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
  if not public.veyora_is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('pending','reviewed','resolved','dismissed') then raise exception 'Invalid status'; end if;
  update public.user_reports set status=p_status,reviewed_at=case when p_status='pending' then null else now() end,reviewer_id=case when p_status='pending' then null else auth.uid() end where id=p_report_id;
  return found;
end;
$$;
grant execute on function public.veyora_admin_set_status(uuid,text) to authenticated;

drop function if exists public.veyora_admin_suspend(uuid,text,boolean);
create or replace function public.veyora_admin_suspend(p_user_id uuid,p_reason text,p_active boolean)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
  if not public.veyora_is_admin() then raise exception 'Admin access required'; end if;
  if p_active then
    insert into public.user_suspensions(user_id,reason,active,updated_at) values(p_user_id,trim(coalesce(p_reason,'Admin action')),true,now())
    on conflict(user_id) do update set reason=excluded.reason,active=true,updated_at=now();
    delete from public.match_queue where user_id=p_user_id;
  else
    update public.user_suspensions set active=false,updated_at=now() where user_id=p_user_id;
  end if;
  return true;
end;
$$;
grant execute on function public.veyora_admin_suspend(uuid,text,boolean) to authenticated;

-- IMPORTANT: after signing in once, add your own Supabase Auth user UUID here:
-- insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID') on conflict do nothing;

-- ============================================================
-- VEYORA PAID MATCHING
-- Free Chat = normal random matching.
-- Paid Chat = only a real currently-waiting FEMALE profile.
-- ============================================================
alter table public.match_queue add column if not exists gender text;
alter table public.match_queue add column if not exists access_type text not null default 'free';

-- Replace the matcher with the paid/female rule while preserving the
-- existing country and atomic-lock behavior.
drop function if exists public.veyora_find_match(uuid,text);
drop function if exists public.veyora_find_match(uuid,text,text,text);
create or replace function public.veyora_find_match(
  p_user_id uuid,
  p_country text,
  p_gender text,
  p_access text
)
returns table(queue_id uuid, matched_user_id uuid, match_id uuid, matched_country text)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  new_match uuid := gen_random_uuid();
  mine uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;

  delete from public.match_queue where user_id = p_user_id;

  select mq.id, mq.user_id, mq.country, mq.gender, mq.access_type
    into candidate
  from public.match_queue mq
  where mq.status = 'waiting'
    and mq.user_id <> p_user_id
    and (coalesce(p_country,'all') = 'all'
         or coalesce(mq.country,'all') = 'all'
         or mq.country = p_country)
    and (
      lower(coalesce(p_access,'free')) <> 'paid'
      or lower(coalesce(mq.gender,'')) = 'female'
    )
  order by mq.joined_at asc
  for update skip locked
  limit 1;

  if found then
    update public.match_queue
       set status='matched', matched_with=p_user_id, match_id=new_match
     where id=candidate.id;

    insert into public.match_queue(user_id,country,gender,access_type,status,matched_with,match_id)
    values(p_user_id,coalesce(p_country,'all'),p_gender,coalesce(p_access,'free'),'matched',candidate.user_id,new_match)
    returning id into mine;

    return query select mine,candidate.user_id,new_match,candidate.country;
  else
    insert into public.match_queue(user_id,country,gender,access_type,status)
    values(p_user_id,coalesce(p_country,'all'),p_gender,coalesce(p_access,'free'),'waiting')
    returning id into mine;

    return query select mine,null::uuid,null::uuid,null::text;
  end if;
end;
$$;

grant execute on function public.veyora_find_match(uuid,text,text,text) to authenticated;
