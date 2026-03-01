-- P2-2: 入力値の長さ制約をDBレベルで追加

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_title_length CHECK (char_length(title) <= 255);

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_memo_length CHECK (memo IS NULL OR char_length(memo) <= 5000);

ALTER TABLE public.categories
  ADD CONSTRAINT categories_name_length CHECK (char_length(name) <= 50);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_nickname_length CHECK (char_length(nickname) <= 30);

ALTER TABLE public.households
  ADD CONSTRAINT households_name_length CHECK (char_length(name) <= 50);
