-- Private bucket for batch critique eval outputs (server uploads via service role).
INSERT INTO storage.buckets (id, name, public)
VALUES ('line-room-evals', 'line-room-evals', false)
ON CONFLICT (id) DO NOTHING;
