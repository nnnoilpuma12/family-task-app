-- The history pager orders by (completed_at DESC, id DESC). Include both
-- columns so equal-timestamp pages do not require an extra sort.
create index if not exists idx_tasks_completed_history_cursor
  on public.tasks (household_id, completed_at desc, id desc)
  where is_done = true and completed_at is not null;
