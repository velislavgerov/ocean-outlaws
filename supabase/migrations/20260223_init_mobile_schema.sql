-- Ocean Outlaws mobile backend bootstrap schema

create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  game_center_id text unique,
  google_play_id text unique,
  display_name text,
  platform text not null default 'ios',
  created_at timestamptz not null default now()
);

create table if not exists public.player_progression (
  player_id uuid primary key references public.players(id) on delete cascade,
  ship_unlocks jsonb not null default '{"destroyer": true, "cruiser": true, "carrier": false, "submarine": false}'::jsonb,
  tech_tree jsonb not null default '{}'::jsonb,
  highest_wave int not null default 0,
  total_kills int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.scores (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  wave_reached int not null,
  score int not null,
  ship_class text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  unique(player_id, achievement_id)
);

create index if not exists idx_scores_wave on public.scores (wave_reached desc, score desc);
create index if not exists idx_scores_player on public.scores (player_id, created_at desc);
create index if not exists idx_achievements_player on public.achievements (player_id, unlocked_at desc);
