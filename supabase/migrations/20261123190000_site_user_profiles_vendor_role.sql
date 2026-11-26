-- One login for Webycitas and the directory (lib/auth/role-access.ts): directory business
-- owners sign in with role 'vendor'. Until now the CHECK only allowed super_admin and owner,
-- so inviting a business owner failed. Existing rows are all super_admin or owner.

ALTER TABLE public.site_user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.site_user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('super_admin', 'owner', 'vendor'));
