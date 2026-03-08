-- ローカル開発用シードデータ
-- テストアカウント: test@example.com / password

-- 1. テストユーザーをauth.usersに登録
--    handle_new_user() トリガーがprofilesを自動作成する
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'authenticated',
  'authenticated',
  'test@example.com',
  crypt('password', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 1b. auth.identities にメールプロバイダー用のアイデンティティを登録
INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  'a0000000-0000-0000-0000-000000000001'::uuid,
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"test@example.com","email_verified":true}',
  'email',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 2. テスト用世帯を作成
INSERT INTO public.households (id, name, created_at, updated_at)
VALUES (
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'テスト家族',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 3. デフォルトカテゴリを作成
SELECT create_default_categories('b0000000-0000-0000-0000-000000000001'::uuid);

-- 4. トリガーで作成されたプロフィールを世帯に紐付け
UPDATE public.profiles
SET
  household_id = 'b0000000-0000-0000-0000-000000000001'::uuid,
  nickname = 'テストユーザー'
WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid;
