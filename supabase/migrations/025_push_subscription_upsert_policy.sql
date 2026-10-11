-- ON CONFLICT (endpoint) DO UPDATE needs an UPDATE policy for a user's own row.
create policy "Users can update own subscriptions"
  on public.push_subscriptions for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
