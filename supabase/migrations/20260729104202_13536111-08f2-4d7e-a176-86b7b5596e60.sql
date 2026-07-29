-- Explicit deny-all policies on storage.objects for the private "anexos" bucket.
-- All legitimate access happens server-side with the service role key
-- (which bypasses RLS) inside authenticated server functions.

DROP POLICY IF EXISTS "anexos_no_client_select" ON storage.objects;
DROP POLICY IF EXISTS "anexos_no_client_insert" ON storage.objects;
DROP POLICY IF EXISTS "anexos_no_client_update" ON storage.objects;
DROP POLICY IF EXISTS "anexos_no_client_delete" ON storage.objects;

CREATE POLICY "anexos_no_client_select"
ON storage.objects FOR SELECT TO anon, authenticated
USING (false);

CREATE POLICY "anexos_no_client_insert"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "anexos_no_client_update"
ON storage.objects FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "anexos_no_client_delete"
ON storage.objects FOR DELETE TO anon, authenticated
USING (false);