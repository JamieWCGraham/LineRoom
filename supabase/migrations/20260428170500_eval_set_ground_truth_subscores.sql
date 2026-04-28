alter table public.generate_critique_eval_set
  add column if not exists ground_truth_subscores jsonb,
  add column if not exists ground_truth_subscores_approved boolean not null default false;
