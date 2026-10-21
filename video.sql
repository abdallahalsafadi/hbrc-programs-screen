-- الفيديو الكبير (حتى 100 ميغابايت) يُرفع على أجزاء ≤ 45 ميغابايت لأن الخطة المجانية تقبل 50 للملف الواحد
alter table public.inbox_videos add column if not exists parts jsonb;

create or replace function public.submit_video(t text, v jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l upload_links; k text := v->>'kind'; u text := v->>'url'; pr jsonb := v->'parts'; x jsonb;
begin
  select * into l from upload_links where token = t and expires_at > now() and kind = 'video';
  if not found then raise exception 'link_expired'; end if;
  if k = 'file' then
    if u not like '%/storage/v1/object/public/media/inbox/' || t || '/%' or coalesce(v->>'path', '') not like 'inbox/' || t || '/%' then
      raise exception 'bad_file'; end if;
    if pr is not null and jsonb_typeof(pr) = 'array' then
      if jsonb_array_length(pr) > 6 then raise exception 'bad_file'; end if;
      for x in select * from jsonb_array_elements(pr) loop
        if coalesce(x->>'path', '') not like 'inbox/' || t || '/%' or coalesce(x->>'url', '') not like '%/storage/v1/object/public/media/inbox/' || t || '/%' then
          raise exception 'bad_file'; end if;
      end loop;
    else pr := null; end if;
  elsif k = 'youtube' then
    if u !~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/' then raise exception 'bad_url'; end if;
    pr := null;
  else raise exception 'bad_kind'; end if;
  insert into inbox_videos (screen, kind, url, path, parts, title, sender)
  values (l.screen, k, left(u, 500), case when k = 'file' then v->>'path' end, pr,
          left(coalesce(v->>'title', ''), 150), left(coalesce(v->>'sender', ''), 120));
end $$;
grant execute on function public.submit_video(text, jsonb) to anon, authenticated;
