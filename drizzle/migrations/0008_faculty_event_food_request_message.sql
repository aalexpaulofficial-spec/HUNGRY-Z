-- Keep existing event request notes compatible with events created before the
-- faculty form removed the optional message field.
ALTER TABLE public.faculty_events
  ADD COLUMN IF NOT EXISTS food_request_message text NOT NULL DEFAULT ''
  CHECK (char_length(food_request_message) <= 500);
