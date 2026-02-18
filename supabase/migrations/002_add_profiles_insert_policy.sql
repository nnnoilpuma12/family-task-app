-- profiles テーブルに INSERT ポリシーを追加
-- ユーザーは自分自身のプロフィールのみ作成可能
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
