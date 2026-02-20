-- Push notification subscriptions for Web Push API
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert/delete their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (profile_id = auth.uid());

-- Users can read subscriptions of household members (needed for sending notifications)
CREATE POLICY "Can read household member subscriptions"
  ON push_subscriptions FOR SELECT
  USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.household_id = get_my_household_id()
    )
  );
