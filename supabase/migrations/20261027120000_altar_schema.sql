-- One altar per person (anonymous Supabase users). Every row carries its
-- owner, and child rows reference (altar_id, owner_id) so nobody can attach
-- rows to someone else's altar.

create table public.altars (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  mood text not null check (mood in ('festive', 'quiet')),
  stage text check (stage in ('interview', 'altar')),
  elements text[] not null default '{}',
  interview_done text[],
  created_at timestamptz not null default now(),
  unique (owner_id),
  unique (id, owner_id)
);

create table public.loved_ones (
  altar_id uuid not null,
  id text not null,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null default '',
  relation text,
  is_child boolean not null default false,
  pronouns text check (pronouns in ('she', 'he', 'they')),
  photo_id text,
  primary key (altar_id, id),
  foreign key (altar_id, owner_id) references public.altars (id, owner_id) on delete cascade
);

create table public.alebrijes (
  altar_id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  traits jsonb not null,
  intro text not null,
  personality text not null,
  image_subject text not null,
  image_id text,
  foreign key (altar_id, owner_id) references public.altars (id, owner_id) on delete cascade
);

create table public.memories (
  altar_id uuid not null,
  id text not null,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  loved_one_id text not null,
  type text not null check (type in ('text', 'photo')),
  text text not null,
  media_id text,
  illustrate boolean not null default false,
  illustration_prompt text,
  illustration_id text,
  illustration_status text not null check (illustration_status in ('none', 'pending', 'done', 'error')),
  source text not null check (source in ('chat', 'manual')),
  position integer not null,
  created_at timestamptz not null,
  primary key (altar_id, id),
  foreign key (altar_id, owner_id) references public.altars (id, owner_id) on delete cascade,
  foreign key (altar_id, loved_one_id) references public.loved_ones (altar_id, id) on delete cascade
);

create table public.altar_objects (
  altar_id uuid not null,
  id text not null,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  loved_one_id text not null,
  name text not null,
  description text not null,
  image_subject text not null,
  image_id text,
  image_src text,
  image_status text not null check (image_status in ('none', 'pending', 'done', 'error')),
  position integer not null,
  created_at timestamptz not null,
  primary key (altar_id, id),
  foreign key (altar_id, owner_id) references public.altars (id, owner_id) on delete cascade,
  foreign key (altar_id, loved_one_id) references public.loved_ones (altar_id, id) on delete cascade
);

create table public.messages (
  altar_id uuid not null,
  id text not null,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant', 'note')),
  text text not null,
  photo_id text,
  cards jsonb,
  skipped boolean,
  position integer not null,
  created_at timestamptz not null,
  primary key (altar_id, id),
  foreign key (altar_id, owner_id) references public.altars (id, owner_id) on delete cascade
);

-- Indexes for the RLS predicate and the composite foreign keys.
create index on public.loved_ones (owner_id);
create index on public.loved_ones (altar_id, owner_id);
create index on public.alebrijes (owner_id);
create index on public.alebrijes (altar_id, owner_id);
create index on public.memories (owner_id);
create index on public.memories (altar_id, owner_id);
create index on public.memories (altar_id, loved_one_id);
create index on public.altar_objects (owner_id);
create index on public.altar_objects (altar_id, owner_id);
create index on public.altar_objects (altar_id, loved_one_id);
create index on public.messages (owner_id);
create index on public.messages (altar_id, owner_id);

-- Row Level Security: each person sees and changes only their own rows.
-- Anonymous users have the authenticated role, so no anon access is needed.
do $$
declare
  t text;
begin
  foreach t in array array['altars', 'loved_ones', 'alebrijes', 'memories', 'altar_objects', 'messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format(
      'create policy "Owners read their %1$s" on public.%1$I for select to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format(
      'create policy "Owners add their %1$s" on public.%1$I for insert to authenticated with check ((select auth.uid()) = owner_id)', t);
    execute format(
      'create policy "Owners change their %1$s" on public.%1$I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format(
      'create policy "Owners delete their %1$s" on public.%1$I for delete to authenticated using ((select auth.uid()) = owner_id)', t);
  end loop;
end $$;

-- Photos and generated images, stored privately at <user id>/<blob id>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('altar-media', 'altar-media', false, 10485760, array['image/*']);

create policy "Owners read their media" on storage.objects for select to authenticated
  using (bucket_id = 'altar-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners add their media" on storage.objects for insert to authenticated
  with check (bucket_id = 'altar-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners change their media" on storage.objects for update to authenticated
  using (bucket_id = 'altar-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'altar-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners delete their media" on storage.objects for delete to authenticated
  using (bucket_id = 'altar-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
