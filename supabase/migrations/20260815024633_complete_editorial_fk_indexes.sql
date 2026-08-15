create index if not exists editorial_import_batches_created_by_idx
  on private.editorial_import_batches (created_by);

create index if not exists questions_created_by_idx
  on public.questions (created_by);

create index if not exists questions_updated_by_idx
  on public.questions (updated_by);
