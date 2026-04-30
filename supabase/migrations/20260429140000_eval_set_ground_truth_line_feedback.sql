alter table public.generate_critique_eval_set
  add column if not exists ground_truth_line_feedback jsonb,
  add column if not exists ground_truth_line_feedback_approved boolean not null default false;
