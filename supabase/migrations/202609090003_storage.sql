-- Supabase-managed storage schema. Screenshots are private and never public event images.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-submissions','event-submissions',false,5242880,array['image/webp']) on conflict(id) do nothing;
create policy submission_images_insert on storage.objects for insert to authenticated with check(bucket_id='event-submissions' and public.is_verified() and (storage.foldername(name))[1]=auth.uid()::text);
create policy submission_images_read on storage.objects for select to authenticated using(bucket_id='event-submissions' and public.is_verified() and ((storage.foldername(name))[1]=auth.uid()::text or public.is_moderator()));
create policy submission_images_delete on storage.objects for delete to authenticated using(bucket_id='event-submissions' and public.is_verified() and (storage.foldername(name))[1]=auth.uid()::text);
