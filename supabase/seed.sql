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
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
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
  '',
  '',
  '',
  '',
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
-- create_default_categories() は auth.uid() チェックがあり未認証シードから呼べないため直接 INSERT する
INSERT INTO public.categories (household_id, name, color, icon, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000001'::uuid, '買い物', '#ef4444', 'shopping-cart', 0),
  ('b0000000-0000-0000-0000-000000000001'::uuid, '料理',   '#f97316', 'chef-hat',      1),
  ('b0000000-0000-0000-0000-000000000001'::uuid, '掃除',   '#22c55e', 'sparkles',      2),
  ('b0000000-0000-0000-0000-000000000001'::uuid, '洗濯',   '#3b82f6', 'shirt',         3),
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'その他', '#6366f1', 'list',          4)
ON CONFLICT DO NOTHING;

-- 4. トリガーで作成されたプロフィールを世帯に紐付け
UPDATE public.profiles
SET
  household_id = 'b0000000-0000-0000-0000-000000000001'::uuid,
  nickname = 'テストユーザー'
WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid;
