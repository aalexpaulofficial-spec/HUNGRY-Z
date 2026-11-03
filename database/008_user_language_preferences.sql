-- One private language preference per signed-in customer or canteen owner.
CREATE TABLE IF NOT EXISTS public.user_language_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'hi', 'kn')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_language_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_language_preferences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_language_preferences TO authenticated;
GRANT ALL ON public.user_language_preferences TO service_role;

DROP POLICY IF EXISTS user_language_preferences_read_own ON public.user_language_preferences;
CREATE POLICY user_language_preferences_read_own ON public.user_language_preferences
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_language_preferences_insert_own ON public.user_language_preferences;
CREATE POLICY user_language_preferences_insert_own ON public.user_language_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_language_preferences_update_own ON public.user_language_preferences;
CREATE POLICY user_language_preferences_update_own ON public.user_language_preferences
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
