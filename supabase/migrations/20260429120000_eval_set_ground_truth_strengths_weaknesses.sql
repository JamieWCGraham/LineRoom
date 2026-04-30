alter table public.generate_critique_eval_set
  add column if not exists ground_truth_strengths_weaknesses jsonb,
  add column if not exists ground_truth_strengths_weaknesses_approved boolean not null default false;
