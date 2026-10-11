-- Public object URLs remain usable, but storage listing is limited to the
-- owner's folder instead of exposing every user's object paths.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Users can list own avatars"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
