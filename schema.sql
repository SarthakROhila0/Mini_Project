-- ============================================================
--  STUDENT INTERACTION PORTAL — SUPABASE SCHEMA
--  Run this entire file once in: Supabase Dashboard → SQL Editor
--  Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------

-- profiles — 1:1 with auth.users
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  email         text not null unique,
  academic_year text default '1st Year',
  branch        text default 'CSE',
  course        text default 'B.Tech',
  role          text not null default 'student' check (role in ('student','moderator','admin')),
  skills        text[] not null default '{}',
  github_url    text default '',
  linkedin_url  text default '',
  website_url   text default '',
  bio           text default '',
  avatar_url    text default '',
  college_domain text default '',
  is_banned     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- channels — created ONLY by admins (enforced by RLS below)
create table if not exists public.channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text default '',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- messages
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 4000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_channel on public.messages(channel_id, created_at);

-- direct_messages — private 1-to-1 chats ("Messages" / DMs)
create table if not exists public.direct_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 4000),
  is_read     boolean not null default false,
  created_at  timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create index if not exists idx_dm_pair   on public.direct_messages(sender_id, receiver_id, created_at);
create index if not exists idx_dm_unread on public.direct_messages(receiver_id, is_read);

-- (for databases created before website links existed)
alter table public.profiles add column if not exists website_url text default '';

-- (resource review workflow for existing databases: old rows stay 'approved',
--  then the default flips so every NEW upload starts as 'pending')
alter table public.resources add column if not exists status text not null default 'approved' check (status in ('pending','approved','rejected'));
alter table public.resources alter column status set default 'pending';
alter table public.resources add column if not exists admin_note text default '';
alter table public.resources add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.resources add column if not exists reviewed_at timestamptz;
create index if not exists idx_resources_status on public.resources(status, created_at desc);

-- hackathon_posts (Teammate Looker)
create table if not exists public.hackathon_posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  tech_stack   text[] not null default '{}',
  team_size    int not null default 2 check (team_size between 1 and 20),
  spots_filled int not null default 1 check (spots_filled >= 0),
  event_type   text not null default 'Hackathon' check (event_type in ('Hackathon','Project','Study Group','Competition','Other')),
  contact      text default '',
  is_open      boolean not null default true,
  created_at   timestamptz not null default now()
);

-- resources (files live in Storage bucket "resources")
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text default '',
  file_url    text not null default '',
  file_name   text default '',
  storage_path text default '',
  category    text not null default 'Notes' check (category in ('Notes','Cheat Sheet','Previous Papers','Books','Slides','Assignments','Other')),
  subject     text default '',
  upvotes     int not null default 0,
  downloads   int not null default 0,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note  text default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- one upvote per user per resource
create table if not exists public.resource_upvotes (
  resource_id uuid not null references public.resources(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (resource_id, user_id)
);

-- roadmaps — public feed shows ONLY status='approved' (enforced by RLS)
create table if not exists public.roadmaps (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  title          text not null,
  content        text not null default '',          -- markdown
  category       text default 'Placements',
  attachment_url text default '',
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note     text default '',
  reviewed_by    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_roadmaps_status on public.roadmaps(status, created_at desc);

-- announcements — only admins/moderators can post (RLS)
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  content    text not null default '',
  event_date timestamptz,
  link       text default '',
  is_pinned  boolean not null default false,
  created_at timestamptz not null default now()
);

-- todos — private per student
create table if not exists public.todos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  task       text not null,
  due_date   date,
  priority   text not null default 'medium' check (priority in ('low','medium','high')),
  completed  boolean not null default false,
  created_at timestamptz not null default now()
);

-- calendar_events — private per student
create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  event_date  date not null,
  description text default '',
  created_at  timestamptz not null default now()
);

-- reports — moderation queue
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('message','user','resource','roadmap','hackathon_post')),
  target_id   text not null,  -- uuid stored as text so any target can be referenced
  reason      text not null check (reason in ('Spam','Harassment','Inappropriate Content','Misinformation','Other')),
  details     text default '',
  status      text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. HELPER FUNCTIONS (SECURITY DEFINER avoids RLS recursion)
-- ------------------------------------------------------------
create or replace function public.current_role() returns text
language sql security definer stable as $$
  select role from public.profiles where id = auth.uid();
$$;
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select coalesce(public.current_role() = 'admin', false);
$$;
create or replace function public.is_mod_or_admin() returns boolean
language sql security definer stable as $$
  select coalesce(public.current_role() in ('admin','moderator'), false);
$$;

-- download counter (callable by any signed-in user)
create or replace function public.increment_download(p_resource uuid) returns void
language sql security definer as $$
  update public.resources set downloads = downloads + 1 where id = p_resource;
$$;

-- team spot counter: lets any student join/leave a team without owning the
-- post (RLS correctly blocks direct UPDATEs on other people's posts).
-- Returns the new spots_filled, clamped to [1, team_size].
create or replace function public.adjust_team_spots(p_post uuid, p_delta int) returns int
language plpgsql security definer as $$
declare new_count int;
begin
  update public.hackathon_posts
     set spots_filled = greatest(1, least(team_size, spots_filled + p_delta))
   where id = p_post
   returning spots_filled into new_count;
  return coalesce(new_count, -1);
end $$;

-- keep resources.upvotes in sync with resource_upvotes
create or replace function public.sync_upvote_count() returns trigger
language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.resources set upvotes = upvotes + 1 where id = new.resource_id; return new;
  elsif (tg_op = 'DELETE') then
    update public.resources set upvotes = greatest(upvotes - 1, 0) where id = old.resource_id; return old;
  end if; return null;
end $$;
drop trigger if exists trg_upvotes on public.resource_upvotes;
create trigger trg_upvotes after insert or delete on public.resource_upvotes
  for each row execute function public.sync_upvote_count();

-- Students can never self-approve a roadmap: force status back to 'pending'
-- on any non-admin update that changes content/title.
create or replace function public.guard_roadmap_status() returns trigger
language plpgsql security definer as $$
begin
  if not public.is_admin() then
    if (tg_op = 'INSERT') then new.status := 'pending'; end if;
    if (tg_op = 'UPDATE' and (new.title <> old.title or new.content <> old.content)) then
      new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null;
    end if;
    if (tg_op = 'UPDATE' and new.status <> old.status and new.title = old.title and new.content = old.content) then
      new.status := old.status; -- silently ignore status changes by non-admins
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_roadmap on public.roadmaps;
create trigger trg_guard_roadmap before insert or update on public.roadmaps
  for each row execute function public.guard_roadmap_status();

-- Same protection for resources: non-admin uploads are forced to 'pending',
-- and non-admins cannot change a resource's status afterwards.
create or replace function public.guard_resource_status() returns trigger
language plpgsql security definer as $$
begin
  if not public.is_admin() then
    if (tg_op = 'INSERT') then new.status := 'pending'; end if;
    if (tg_op = 'UPDATE' and new.status <> old.status) then new.status := old.status; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_resource on public.resources;
create trigger trg_guard_resource before insert or update on public.resources
  for each row execute function public.guard_resource_status();

-- auto-create a profile row on signup + extract college domain ("Server" namespace)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, college_domain)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    lower(split_part(new.email,'@',2))
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_touch_profile on public.profiles;
create trigger trg_touch_profile before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.channels         enable row level security;
alter table public.messages         enable row level security;
alter table public.direct_messages  enable row level security;
alter table public.hackathon_posts  enable row level security;
alter table public.resources        enable row level security;
alter table public.resource_upvotes enable row level security;
alter table public.roadmaps         enable row level security;
alter table public.announcements    enable row level security;
alter table public.todos            enable row level security;
alter table public.calendar_events  enable row level security;
alter table public.reports          enable row level security;

-- PROFILES: readable by signed-in users (needed for names/avatars in chat);
-- update own row; admins may update any row (role assignment / ban).
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_upd    on public.profiles;
drop policy if exists profiles_admin  on public.profiles;
drop policy if exists profiles_insert on public.profiles;
create policy profiles_read  on public.profiles for select to authenticated using (true);
create policy profiles_upd   on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.current_role()); -- students can't self-promote
create policy profiles_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- CHANNELS: everyone reads; only admins create/update/delete.
drop policy if exists channels_read  on public.channels;
drop policy if exists channels_write on public.channels;
create policy channels_read  on public.channels for select to authenticated using (true);
create policy channels_write on public.channels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- MESSAGES: everyone reads; insert as self; delete own or (mod/admin).
drop policy if exists messages_read   on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_delete on public.messages;
drop policy if exists messages_update on public.messages;
create policy messages_read   on public.messages for select to authenticated using (true);
create policy messages_insert on public.messages for insert to authenticated with check (user_id = auth.uid());
create policy messages_delete on public.messages for delete to authenticated
  using (user_id = auth.uid() or public.is_mod_or_admin());
create policy messages_update on public.messages for update to authenticated
  using (user_id = auth.uid() or public.is_mod_or_admin()) with check (user_id = auth.uid() or public.is_mod_or_admin());

-- DIRECT MESSAGES: strictly between the two participants.
-- Read if you are sender or receiver; send only as yourself;
-- only the receiver may update (mark-as-read); delete your own sent messages.
drop policy if exists dm_read   on public.direct_messages;
drop policy if exists dm_insert on public.direct_messages;
drop policy if exists dm_update on public.direct_messages;
drop policy if exists dm_delete on public.direct_messages;
create policy dm_read   on public.direct_messages for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy dm_insert on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid());
create policy dm_update on public.direct_messages for update to authenticated
  using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());
create policy dm_delete on public.direct_messages for delete to authenticated
  using (sender_id = auth.uid() or public.is_mod_or_admin());

-- HACKATHON POSTS: everyone reads; CRUD own; mods/admins can delete any.
drop policy if exists hp_read   on public.hackathon_posts;
drop policy if exists hp_insert on public.hackathon_posts;
drop policy if exists hp_update on public.hackathon_posts;
drop policy if exists hp_delete on public.hackathon_posts;
create policy hp_read   on public.hackathon_posts for select to authenticated using (true);
create policy hp_insert on public.hackathon_posts for insert to authenticated with check (user_id = auth.uid());
create policy hp_update on public.hackathon_posts for update to authenticated
  using (user_id = auth.uid() or public.is_mod_or_admin())
  with check (user_id = auth.uid() or public.is_mod_or_admin()); -- spot joins go through adjust_team_spots() RPC
create policy hp_delete on public.hackathon_posts for delete to authenticated
  using (user_id = auth.uid() or public.is_mod_or_admin());

-- RESOURCES: everyone reads; insert own; delete own/mod; counters via triggers/RPC.
drop policy if exists res_read   on public.resources;
drop policy if exists res_insert on public.resources;
drop policy if exists res_update on public.resources;
drop policy if exists res_delete on public.resources;
create policy res_read   on public.resources for select to authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_mod_or_admin());
create policy res_insert on public.resources for insert to authenticated with check (user_id = auth.uid());
create policy res_update on public.resources for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists res_admin_update on public.resources;
create policy res_admin_update on public.resources for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy res_delete on public.resources for delete to authenticated
  using (user_id = auth.uid() or public.is_mod_or_admin());

-- UPVOTES: read all (to show voted state); vote/unvote as self.
drop policy if exists uv_read  on public.resource_upvotes;
drop policy if exists uv_write on public.resource_upvotes;
create policy uv_read  on public.resource_upvotes for select to authenticated using (true);
create policy uv_write on public.resource_upvotes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ROADMAPS: approved visible to all; pending/rejected only to owner + mods/admins.
drop policy if exists rm_read   on public.roadmaps;
drop policy if exists rm_insert on public.roadmaps;
drop policy if exists rm_update on public.roadmaps;
drop policy if exists rm_delete on public.roadmaps;
create policy rm_read on public.roadmaps for select to authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_mod_or_admin());
create policy rm_insert on public.roadmaps for insert to authenticated with check (user_id = auth.uid());
create policy rm_update on public.roadmaps for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy rm_delete on public.roadmaps for delete to authenticated
  using (user_id = auth.uid() or public.is_mod_or_admin());

-- ANNOUNCEMENTS: everyone reads; only mods/admins write.
drop policy if exists ann_read  on public.announcements;
drop policy if exists ann_write on public.announcements;
create policy ann_read  on public.announcements for select to authenticated using (true);
create policy ann_write on public.announcements for all to authenticated
  using (public.is_mod_or_admin()) with check (public.is_mod_or_admin() and admin_id = auth.uid());

-- TODOS & CALENDAR: strictly private.
drop policy if exists todos_all on public.todos;
drop policy if exists cal_all   on public.calendar_events;
create policy todos_all on public.todos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cal_all on public.calendar_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- REPORTS: file as self; read own; mods/admins read + update all.
drop policy if exists rep_insert on public.reports;
drop policy if exists rep_read   on public.reports;
drop policy if exists rep_update on public.reports;
create policy rep_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy rep_read   on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_mod_or_admin());
create policy rep_update on public.reports for update to authenticated
  using (public.is_mod_or_admin()) with check (public.is_mod_or_admin());

-- ------------------------------------------------------------
-- 4. REALTIME — enable live chat + announcements
-- ------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.messages;      exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.channels;       exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.direct_messages; exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 5. STORAGE BUCKETS + POLICIES
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('resources','resources', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
  on conflict (id) do nothing;

drop policy if exists "resources public read"   on storage.objects;
drop policy if exists "resources auth upload"   on storage.objects;
drop policy if exists "resources owner delete"  on storage.objects;
create policy "resources public read" on storage.objects for select
  using (bucket_id in ('resources','avatars'));
create policy "resources auth upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('resources','avatars'));
create policy "resources owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('resources','avatars') and owner = auth.uid());

-- ------------------------------------------------------------
-- 6. SEED CHANNELS (created_by left null until first admin exists)
-- ------------------------------------------------------------
insert into public.channels (name, description) values
  ('general',        'Campus-wide casual chat'),
  ('announcements',  'Official updates (read-only feel — pair with Announcements feed)'),
  ('placements',     'Internships, PPOs and placement prep'),
  ('coding-help',    'DSA doubts, debugging help, code reviews'),
  ('hackathons',     'Hackathon discussions and team hunts')
on conflict (name) do nothing;

-- ============================================================
--  AFTER RUNNING:
--  1) Sign up in the app with your admin email.
--  2) Promote yourself (run once, replacing the email):
--       update public.profiles set role = 'admin'
--       where email = 'you@college.edu';
--  3) (Optional) Authentication → Providers → Email:
--     keep "Confirm email" OFF for hackathon demos, ON for production.
--  4) (Optional) Enforce the college domain at the DB level too:
--       Authentication → Hooks / or add a BEFORE INSERT trigger on
--       auth.users checking email like '%@college.edu'.
--     The frontend already blocks non-college emails.
-- ============================================================
