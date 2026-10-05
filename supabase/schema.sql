-- ═══════════════════════════════════════════════════════════════
--  FOCUSSPACE 2.0 — DATABASE SCHEMA (Supabase / PostgreSQL)
--  Cara pakai: buka Supabase Dashboard → SQL Editor → paste
--  seluruh file ini → Run. Boleh dijalankan berulang (idempotent).
-- ═══════════════════════════════════════════════════════════════

-- ══ 1. PROFILES ══
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text not null default 'Anak Kopi',
  avatar           text not null default '☕',
  status           text not null default 'focus',
  xp               int  not null default 0,
  streak_current   int  not null default 0,
  streak_longest   int  not null default 0,
  last_active_date date,
  created_at       timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all" on public.profiles
  for select using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-buat profile saat user baru mendaftar
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      'Anak Kopi ' || upper(substr(new.id::text, 1, 2))
    ),
    coalesce((new.raw_user_meta_data->>'avatar'), '🐣')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ══ 2. RPC: STREAK & XP ══
create or replace function public.touch_streak(p_xp int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  today date := current_date;
  last  date;
  cur   int;
  lon   int;
begin
  if uid is null then return; end if;
  insert into public.profiles (id) values (uid) on conflict (id) do nothing;

  select last_active_date, streak_current, streak_longest
    into last, cur, lon
  from public.profiles where id = uid for update;

  if last is null or last < today then
    cur := case when last = today - 1 then coalesce(cur, 0) + 1 else 1 end;
    update public.profiles
      set streak_current = cur,
          streak_longest = greatest(coalesce(lon, 0), cur),
          last_active_date = today
    where id = uid;
  end if;

  update public.profiles set xp = xp + greatest(p_xp, 0) where id = uid;
end;
$$;

grant execute on function public.touch_streak(int) to authenticated, anon;

-- ══ 3. TASKS (Target Hari Ini) ══
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  emoji      text,
  priority   text not null default 'normal',
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  done_at    timestamptz
);
alter table public.tasks enable row level security;

drop policy if exists "tasks all own" on public.tasks;
create policy "tasks all own" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ══ 4. FOCUS SESSIONS ══
create table if not exists public.focus_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  mode         text not null default 'focus',
  duration_sec int  not null,
  completed    boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.focus_sessions enable row level security;

drop policy if exists "focus_sessions all own" on public.focus_sessions;
create policy "focus_sessions all own" on public.focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ══ 5. STUDY ROOMS (ruangan chat) ══
create table if not exists public.study_rooms (
  id            uuid primary key default gen_random_uuid(),
  name          text unique not null,
  password_hash text,
  owner_id      uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.study_rooms enable row level security;

drop policy if exists "study_rooms readable" on public.study_rooms;
create policy "study_rooms readable" on public.study_rooms
  for select using (true);

drop policy if exists "study_rooms insert authed" on public.study_rooms;
create policy "study_rooms insert authed" on public.study_rooms
  for insert with check (auth.uid() is not null);

drop policy if exists "study_rooms owner update" on public.study_rooms;
create policy "study_rooms owner update" on public.study_rooms
  for update using (auth.uid() = owner_id);

drop policy if exists "study_rooms owner delete" on public.study_rooms;
create policy "study_rooms owner delete" on public.study_rooms
  for delete using (auth.uid() = owner_id);

-- ══ 6. ROOM MESSAGES ══
create table if not exists public.room_messages (
  id         uuid primary key default gen_random_uuid(),
  room_name  text not null,
  user_id    uuid,
  sender     text not null,
  avatar     text not null default '☕',
  body       text not null default '',
  image_url  text,
  is_kazu    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.room_messages enable row level security;

drop policy if exists "room_messages readable" on public.room_messages;
create policy "room_messages readable" on public.room_messages
  for select using (true);

drop policy if exists "room_messages insert authed" on public.room_messages;
create policy "room_messages insert authed" on public.room_messages
  for insert with check (auth.uid() is not null);

-- ══ 7. VOICE CHANNELS ══
create table if not exists public.voice_channels (
  id         uuid primary key default gen_random_uuid(),
  room_name  text not null,
  name       text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.voice_channels enable row level security;

drop policy if exists "voice_channels readable" on public.voice_channels;
create policy "voice_channels readable" on public.voice_channels
  for select using (true);

drop policy if exists "voice_channels insert authed" on public.voice_channels;
create policy "voice_channels insert authed" on public.voice_channels
  for insert with check (auth.uid() is not null);

drop policy if exists "voice_channels creator delete" on public.voice_channels;
create policy "voice_channels creator delete" on public.voice_channels
  for delete using (auth.uid() = created_by);

-- ══ 8. QUIZ SETS ══
create table if not exists public.quiz_sets (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid references auth.users(id) on delete cascade,
  host_name  text not null default 'Anonim',
  title      text not null,
  topic      text,
  emoji      text not null default '🎲',
  questions  jsonb not null default '[]'::jsonb,
  is_public  boolean not null default true,
  plays      int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.quiz_sets enable row level security;

drop policy if exists "quiz_sets read public or own" on public.quiz_sets;
create policy "quiz_sets read public or own" on public.quiz_sets
  for select using (is_public = true or auth.uid() = host_id);

drop policy if exists "quiz_sets insert authed" on public.quiz_sets;
create policy "quiz_sets insert authed" on public.quiz_sets
  for insert with check (auth.uid() is not null);

drop policy if exists "quiz_sets host update" on public.quiz_sets;
create policy "quiz_sets host update" on public.quiz_sets
  for update using (auth.uid() = host_id);

drop policy if exists "quiz_sets host delete" on public.quiz_sets;
create policy "quiz_sets host delete" on public.quiz_sets
  for delete using (auth.uid() = host_id);

-- ══ 9. QUIZ ATTEMPTS (hasil & podium) ══
create table if not exists public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  set_id      uuid references public.quiz_sets(id) on delete cascade,
  room_code   text,
  user_id     uuid,
  player_name text not null,
  score       int not null default 0,
  total       int not null default 0,
  answers     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.quiz_attempts enable row level security;

drop policy if exists "quiz_attempts readable" on public.quiz_attempts;
create policy "quiz_attempts readable" on public.quiz_attempts
  for select using (true);

drop policy if exists "quiz_attempts insert authed" on public.quiz_attempts;
create policy "quiz_attempts insert authed" on public.quiz_attempts
  for insert with check (auth.uid() is not null);

-- ══ 10. GAME SCORES ══
create table if not exists public.game_scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  game       text not null,
  score      int not null default 0,
  won        boolean not null default false,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.game_scores enable row level security;

drop policy if exists "game_scores all own" on public.game_scores;
create policy "game_scores all own" on public.game_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ══ 11. REALTIME ══
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.study_rooms;
alter publication supabase_realtime add table public.voice_channels;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.quiz_sets;

-- ══ 12. STORAGE (gambar chat) ══
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "chat-images upload" on storage.objects;
create policy "chat-images upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images');

drop policy if exists "chat-images public read" on storage.objects;
create policy "chat-images public read" on storage.objects
  for select using (bucket_id = 'chat-images');

-- ══ SELESAI ══
-- Catatan:
--  • Login Tamu butuh: Authentication → Sign In / Up → centang "Allow anonymous sign-ins"
--  • Login Google (opsional): Authentication → Providers → Google
--  • Email OTP: Authentication → Providers → Email (default aktif)
