-- Enforce limits from the forms for API clients as well. NOT VALID keeps
-- pre-existing user content intact while checking all new writes.
alter table public.tasks
  add constraint tasks_title_nonblank check (char_length(trim(title)) >= 1) not valid,
  add constraint tasks_url_length check (url is null or char_length(url) <= 2048) not valid;

alter table public.categories
  add constraint categories_name_nonblank check (char_length(trim(name)) >= 1) not valid,
  add constraint categories_color_format check (color ~ '^#[0-9a-fA-F]{6}$') not valid;

alter table public.staple_items
  add constraint staple_items_name_length check (char_length(trim(name)) between 1 and 255) not valid,
  add constraint staple_items_note_length check (note is null or char_length(note) <= 1000) not valid,
  add constraint staple_items_quantity_nonnegative check (default_quantity is null or default_quantity >= 0) not valid,
  add constraint staple_items_use_count_nonnegative check (use_count >= 0) not valid;

-- A category FK on its own permits a task in household A to point to a
-- category from household B. Repair any such rows before adding composite FKs.
update public.tasks t
set category_id = (
  select c.id from public.categories c
  where c.household_id = t.household_id
  order by c.sort_order, c.created_at, c.id limit 1
)
where t.category_id is not null
  and not exists (
    select 1 from public.categories c
    where c.id = t.category_id and c.household_id = t.household_id
  );

update public.staple_items si
set category_id = (
  select c.id from public.categories c
  where c.household_id = si.household_id
  order by c.sort_order, c.created_at, c.id limit 1
)
where si.category_id is not null
  and not exists (
    select 1 from public.categories c
    where c.id = si.category_id and c.household_id = si.household_id
  );

alter table public.categories
  add constraint categories_household_id_id_unique unique (household_id, id);

alter table public.tasks
  add constraint tasks_category_same_household
  foreign key (household_id, category_id)
  references public.categories(household_id, id) not valid;

alter table public.staple_items
  add constraint staple_items_category_same_household
  foreign key (household_id, category_id)
  references public.categories(household_id, id) not valid;

alter table public.tasks validate constraint tasks_category_same_household;
alter table public.staple_items validate constraint staple_items_category_same_household;
