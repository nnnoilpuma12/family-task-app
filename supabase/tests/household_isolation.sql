begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

-- 自世帯は seed の利用者を使う。別世帯の行は権限を切り替える前に作る。
insert into public.households (id, name)
values ('b1000000-0000-0000-0000-000000000002', 'isolation test household');
insert into public.categories (id, household_id, name, color, sort_order) values
  ('c1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'own category', '#6366f1', 17),
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'foreign category', '#6366f1', 23);
insert into public.tasks (id, household_id, category_id, title) values
  ('d1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'own task'),
  ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'foreign task');
insert into public.staple_items (id, household_id, category_id, name)
values ('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'foreign staple');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

select is((select count(*) from public.tasks where id = 'd1000000-0000-0000-0000-000000000002'),
  0::bigint, 'another household task is invisible');
select is((select count(*) from public.staple_items where id = 'e1000000-0000-0000-0000-000000000002'),
  0::bigint, 'another household staple is invisible');
select is((select count(*) from public.categories where id = 'c1000000-0000-0000-0000-000000000002'),
  0::bigint, 'another household category is invisible');

with changed as (
  update public.tasks set title = 'unauthorized edit'
  where id = 'd1000000-0000-0000-0000-000000000002' returning id
)
select is((select count(*) from changed), 0::bigint, 'another household task cannot be updated');
with deleted as (
  delete from public.tasks where id = 'd1000000-0000-0000-0000-000000000002' returning id
)
select is((select count(*) from deleted), 0::bigint, 'another household task cannot be deleted');

select throws_ok(
  $$ insert into public.tasks (household_id, title)
     values ('b1000000-0000-0000-0000-000000000002', 'unauthorized insert') $$,
  '42501', 'new row violates row-level security policy for table "tasks"',
  'a task cannot be inserted into another household'
);

select throws_ok(
  $$ select public.reorder_categories(
       array['c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002']::uuid[],
       array[0, 1]) $$,
  'P0001', 'Category does not belong to your household',
  'a mixed household reorder is rejected'
);
select is((select sort_order from public.categories where id = 'c1000000-0000-0000-0000-000000000001'),
  17, 'a rejected mixed reorder does not partially change the own category');

select throws_ok(
  $$ select public.record_staple_usage('e1000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Item does not belong to your household',
  'usage cannot be recorded for another household staple'
);
select throws_ok(
  $$ select public.delete_category_with_fallback(
       'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Category or fallback not found in your household',
  'another household category cannot be used as a fallback'
);
select is((select count(*) from public.categories where id = 'c1000000-0000-0000-0000-000000000001'),
  1::bigint, 'a rejected fallback keeps the original category');
select is((select category_id from public.tasks where id = 'd1000000-0000-0000-0000-000000000001'),
  'c1000000-0000-0000-0000-000000000001'::uuid, 'a rejected fallback preserves the own task category');

select * from finish();
rollback;
