-- روابط الرفع المؤقتة (24 ساعة) — يرسلها المشرف لأي شخص ليرفع فيديو أو برنامجاً إلى شاشة قسم
alter table public.programs add column if not exists pending boolean not null default false;

create table if not exists public.upload_links (
  token      text primary key default encode(gen_random_bytes(12), 'hex'),
  screen     text not null references public.screens(slug) on update cascade on delete cascade,
  kind       text not null check (kind in ('program', 'video')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
alter table public.upload_links enable row level security;
drop policy if exists "admin links" on public.upload_links;
create policy "admin links" on public.upload_links for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.upload_links to authenticated;

-- الفيديوهات الواردة بانتظار موافقة المشرف
create table if not exists public.inbox_videos (
  id         uuid primary key default gen_random_uuid(),
  screen     text not null references public.screens(slug) on update cascade on delete cascade,
  kind       text not null check (kind in ('file', 'youtube')),
  url        text not null,
  path       text,
  title      text,
  sender     text,
  created_at timestamptz not null default now()
);
alter table public.inbox_videos enable row level security;
drop policy if exists "admin inbox" on public.inbox_videos;
create policy "admin inbox" on public.inbox_videos for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.inbox_videos to authenticated;

-- معلومات الرابط (للصفحة العامة) — لا تكشف شيئاً إن كان الرابط منتهياً
create or replace function public.link_info(t text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('screen', l.screen, 'name', s.name, 'kind', l.kind, 'expires_at', l.expires_at)
  from upload_links l join screens s on s.slug = l.screen
  where l.token = t and l.expires_at > now();
$$;
grant execute on function public.link_info(text) to anon, authenticated;

create or replace function public.link_valid(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from upload_links where token = t and expires_at > now());
$$;
grant execute on function public.link_valid(text) to anon, authenticated;

-- إرسال برنامج عبر الرابط: يُضاف مخفياً «بانتظار الموافقة»
create or replace function public.submit_program(t text, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l upload_links;
begin
  select * into l from upload_links where token = t and expires_at > now() and kind = 'program';
  if not found then raise exception 'link_expired'; end if;
  if coalesce(trim(p->>'title'), '') = '' then raise exception 'title_required'; end if;
  insert into programs (title, owner, status, start_date, end_date, logo_url, image_url, screen, visible, pending, sort_order)
  values (left(trim(p->>'title'), 200), left(nullif(trim(p->>'owner'), ''), 120),
          case when p->>'status' in ('current', 'upcoming', 'completed') then p->>'status' else 'upcoming' end,
          nullif(p->>'start_date', '')::date, nullif(p->>'end_date', '')::date,
          case when p->>'logo_url' like '%/storage/v1/object/public/media/inbox/' || t || '/%' then p->>'logo_url' end,
          case when p->>'image_url' like '%/storage/v1/object/public/media/inbox/' || t || '/%' then p->>'image_url' end,
          l.screen, false, true,
          coalesce((select max(sort_order) from programs where screen = l.screen), 0) + 1);
end $$;
grant execute on function public.submit_program(text, jsonb) to anon, authenticated;

-- إرسال فيديو عبر الرابط: يدخل صندوق الوارد
create or replace function public.submit_video(t text, v jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l upload_links; k text := v->>'kind'; u text := v->>'url';
begin
  select * into l from upload_links where token = t and expires_at > now() and kind = 'video';
  if not found then raise exception 'link_expired'; end if;
  if k = 'file' then
    if u not like '%/storage/v1/object/public/media/inbox/' || t || '/%' or coalesce(v->>'path', '') not like 'inbox/' || t || '/%' then
      raise exception 'bad_file'; end if;
  elsif k = 'youtube' then
    if u !~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/' then raise exception 'bad_url'; end if;
  else raise exception 'bad_kind'; end if;
  insert into inbox_videos (screen, kind, url, path, title, sender)
  values (l.screen, k, left(u, 500), case when k = 'file' then v->>'path' end,
          left(coalesce(v->>'title', ''), 150), left(coalesce(v->>'sender', ''), 120));
end $$;
grant execute on function public.submit_video(text, jsonb) to anon, authenticated;

-- السماح بالرفع إلى مجلد inbox/<الرمز>/ فقط لحامل رابط صالح
drop policy if exists "media insert" on storage.objects;
create policy "media insert" on storage.objects for insert
  with check (bucket_id = 'media' and (public.is_admin()
    or (split_part(name, '/', 1) = 'inbox' and public.link_valid(split_part(name, '/', 2)))));
