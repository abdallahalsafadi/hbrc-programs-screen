-- شاشات الأقسام: كل قسم له رابط ومحتوى مستقل
create table if not exists public.screens (
  slug       text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name       text not null,
  data       jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- الشاشة الحالية تصبح الشاشة الرئيسية "main" بنفس إعداداتها
insert into public.screens (slug, name, data, sort_order)
select 'main', 'مركز حمدان بن راشد آل مكتوم للموهبة والابتكار',
       coalesce((select data from public.settings where id = 1), '{}'::jsonb), 0
on conflict (slug) do nothing;

alter table public.screens enable row level security;
drop policy if exists "read screens"   on public.screens;
drop policy if exists "insert screens" on public.screens;
drop policy if exists "update screens" on public.screens;
drop policy if exists "delete screens" on public.screens;
create policy "read screens"   on public.screens for select using (true);
create policy "insert screens" on public.screens for insert with check (public.is_admin());
create policy "update screens" on public.screens for update using (public.is_admin()) with check (public.is_admin());
create policy "delete screens" on public.screens for delete using (public.is_admin() and slug <> 'main');
grant select on public.screens to anon;
grant select, insert, update, delete on public.screens to authenticated;

-- كل برنامج يتبع شاشة (البرامج الحالية تذهب للشاشة الرئيسية)
alter table public.programs add column if not exists screen text not null default 'main';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'programs_screen_fk') then
    alter table public.programs add constraint programs_screen_fk
      foreign key (screen) references public.screens(slug) on update cascade on delete cascade;
  end if;
end $$;
create index if not exists programs_screen_idx on public.programs(screen);
