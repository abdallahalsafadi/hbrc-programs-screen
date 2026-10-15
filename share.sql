-- مشاركة البرامج بين الأقسام
alter table public.programs add column if not exists shared boolean not null default false;
alter table public.programs add column if not exists source text;
create index if not exists programs_shared_idx on public.programs(shared) where shared;
