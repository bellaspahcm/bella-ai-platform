-- REVIEW ONLY. PRODUCTION WRITE HOLD. A Storage object owner must execute this.
-- Create the policy before provisioning the bucket to avoid direct client access.
BEGIN;
DO $$
DECLARE v_owner oid;
BEGIN
  SELECT c.relowner INTO v_owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='storage' AND c.relname='objects' AND c.relrowsecurity;
  IF v_owner IS NULL OR (current_user<>pg_get_userbyid(v_owner) AND NOT pg_has_role(current_user,pg_get_userbyid(v_owner),'MEMBER')) THEN
    RAISE EXCEPTION 'Storage objects owner authority and RLS are required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='interior_site_evidence_no_direct_client_access') THEN
    RAISE EXCEPTION 'P4 Storage policy name exists; compare the definition before any change';
  END IF;
END;
$$;
CREATE POLICY interior_site_evidence_no_direct_client_access
  ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'interior-site-evidence')
  WITH CHECK (bucket_id <> 'interior-site-evidence');
COMMIT;
