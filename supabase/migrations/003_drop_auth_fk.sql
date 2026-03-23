-- Drop FK constraint so dev UUIDs (not in auth.users) can be used during development
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
