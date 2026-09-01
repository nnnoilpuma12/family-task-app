-- ============================================
-- 019: ユーザーアイコン（カスタム画像）用の Storage バケット
-- ============================================
-- profiles.avatar_url はこれまで 'emoji:<key>' 形式のプリセットのみを保持していた。
-- 本マイグレーションで、ユーザーが任意の画像をアイコンに設定できるよう
-- 'avatars' バケットを追加する。avatar_url には公開 URL をそのまま保存し、
-- アプリ側は 'emoji:' 接頭辞かどうかでプリセット / 画像を判別する。
--
-- 設計方針：
--   * オブジェクトのパスは <auth.uid()>/<ランダム UUID>.<ext>。
--     先頭フォルダを所有者 id にすることで RLS を storage.foldername で表現できる。
--   * バケットは public（＝ URL を知っていれば誰でも取得可）。
--     世帯メンバー一覧・担当者アバターなど参照箇所が多く、署名 URL の失効を
--     クライアントキャッシュ（React Query 永続化）と両立させるのが難しいため。
--     ファイル名を UUID にして URL を推測不能にすることで代替する。
--   * アップロードは 2MiB / 画像 3 形式に制限。クライアントは 256px の
--     WebP（非対応環境では JPEG）へ変換してから送るため実際は数十 KB に収まる。
-- ============================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MiB
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================
-- storage.objects の RLS
-- ============================================
-- 参照は全員可（public バケットのため anon も含む）。
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- 書き込みは「自分の id フォルダ配下」のみ。
drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 差し替え・リセット時に旧ファイルを消すため DELETE も自分の配下のみ許可する。
drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- ============================================
-- avatar_url の長さ制約
-- ============================================
-- 006 で他カラムには長さ制約を入れたが avatar_url は素通しだった。
-- URL を保存するようになるため上限を設ける（公開 URL は 200 文字程度）。
alter table public.profiles
  add constraint profiles_avatar_url_length
  check (avatar_url is null or char_length(avatar_url) <= 500);
