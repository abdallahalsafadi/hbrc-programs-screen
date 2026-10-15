-- =====================================================================
--  قاعدة بيانات لوحة برامج مركز حمدان بن راشد للموهبة والابتكار
--  الصق هذا الملف كاملاً في Supabase → SQL Editor ثم اضغط Run
--  آمن لإعادة التشغيل (لن يكرر البيانات)
-- =====================================================================

create extension if not exists pgcrypto;

-- 1) المشرف الوحيد ------------------------------------------------------
create table if not exists public.app_admins (email text primary key);
-- إن غيّرت ADMIN_EMAIL_DOMAIN في config.js فغيّر البريد هنا أيضاً
insert into public.app_admins(email) values ('admin@hbrc-admin.local') on conflict do nothing;
alter table public.app_admins enable row level security;   -- لا توجد سياسات = لا أحد يقرؤها عبر الإنترنت

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) البرامج -------------------------------------------------------------
create table if not exists public.programs (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  summary      text,
  description  text,
  category     text,
  status       text not null default 'upcoming' check (status in ('current','upcoming','completed')),
  start_date   date,
  end_date     date,
  schedule     text,
  location     text,
  audience     text,
  seats        int,
  registered   int,
  image_url    text,
  register_url text,
  contact      text,
  featured     boolean not null default false,
  visible      boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.programs add column if not exists logo_url text;
alter table public.programs add column if not exists owner text;
alter table public.programs enable row level security;

drop policy if exists "read programs"   on public.programs;
drop policy if exists "insert programs" on public.programs;
drop policy if exists "update programs" on public.programs;
drop policy if exists "delete programs" on public.programs;
create policy "read programs"   on public.programs for select using (visible or public.is_admin());
create policy "insert programs" on public.programs for insert with check (public.is_admin());
create policy "update programs" on public.programs for update using (public.is_admin()) with check (public.is_admin());
create policy "delete programs" on public.programs for delete using (public.is_admin());

-- 3) إعدادات الموقع (صف واحد) -------------------------------------------
create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings(id, data) values (1, '{}'::jsonb) on conflict do nothing;
alter table public.settings enable row level security;

drop policy if exists "read settings"   on public.settings;
drop policy if exists "insert settings" on public.settings;
drop policy if exists "update settings" on public.settings;
create policy "read settings"   on public.settings for select using (true);
create policy "insert settings" on public.settings for insert with check (public.is_admin());
create policy "update settings" on public.settings for update using (public.is_admin()) with check (public.is_admin());

-- صلاحيات واجهة البيانات (الحماية الفعلية عبر السياسات أعلاه)
grant usage on schema public to anon, authenticated;
grant select on public.programs, public.settings to anon;
grant select, insert, update, delete on public.programs, public.settings to authenticated;

-- 4) تخزين الصور -----------------------------------------------------------
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
-- صور حتى 5MB وفيديو MP4 حتى 50MB (حد الخطة المجانية)
update storage.buckets set file_size_limit = 52428800,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml','image/gif','video/mp4','video/webm']
where id = 'media';

drop policy if exists "media read"   on storage.objects;
drop policy if exists "media insert" on storage.objects;
drop policy if exists "media update" on storage.objects;
drop policy if exists "media delete" on storage.objects;
create policy "media read"   on storage.objects for select using (bucket_id = 'media');
create policy "media insert" on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
create policy "media update" on storage.objects for update using (bucket_id = 'media' and public.is_admin());
create policy "media delete" on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

-- 5) برامج نموذجية (تُضاف مرة واحدة فقط إذا كان الجدول فارغاً — احذفها من لوحة الإدارة) --
insert into public.programs
  (title, category, status, featured, sort_order, owner, start_date, end_date, schedule, location, audience, seats, registered)
select * from (values
  ('برنامج رعاية الموهوبين', 'الموهبة', 'current', true, 1,
   'أ. محمد علي',
   '2026-09-07'::date, '2027-06-17'::date, 'أيام السبت 9:00 ص – 1:00 م', 'مقر المركز – دبي', 'الطلبة الموهوبون من الصف الرابع إلى الثاني عشر', 120, 104),
  ('فريق FIRST LEGO League', 'الروبوتات', 'current', false, 2,
   'م. سارة أحمد',
   '2026-09-14'::date, '2027-02-28'::date, 'الإثنين والأربعاء 3:30 – 5:30 م', 'مختبر الروبوتات', 'الطلبة من عمر 9 إلى 16 سنة', 30, 30),
  ('البرنامج الشتوي 2026', 'العلوم والتقنية', 'upcoming', true, 3,
   'أ. مريم حسن',
   '2026-12-14'::date, '2026-12-31'::date, 'يومياً 9:00 ص – 2:00 م', 'مقر المركز – دبي', 'الطلبة من الصف الثالث إلى الحادي عشر', 150, 37),
  ('اختبارات الكشف عن الموهوبين', 'الموهبة', 'upcoming', false, 4,
   'أ. نورة سالم',
   '2027-01-18'::date, '2027-02-05'::date, null, 'مقر المركز – دبي', 'طلبة الصفين الثالث والرابع', null, null)
) as v(title, category, status, featured, sort_order, owner, start_date, end_date, schedule, location, audience, seats, registered)
where not exists (select 1 from public.programs);
