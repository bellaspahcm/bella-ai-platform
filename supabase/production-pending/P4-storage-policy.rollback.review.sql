-- REVIEW ONLY. Keep this protection while the evidence bucket exists.
BEGIN;
DO $$
DECLARE v_owner oid;
BEGIN
  SELECT c.relowner INTO v_owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='storage' AND c.relname='objects';
  IF v_owner IS NULL OR (current_user<>pg_get_userbyid(v_owner) AND NOT pg_has_role(current_user,pg_get_userbyid(v_owner),'MEMBER')) THEN
    RAISE EXCEPTION 'Storage objects owner authority is required';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id='interior-site-evidence') THEN
    RAISE EXCEPTION 'Evidence bucket still exists; keep restrictive policy until an approved equivalent is in place';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects'
      AND p.policyname='interior_site_evidence_no_direct_client_access' AND p.permissive='RESTRICTIVE'
      AND p.cmd='ALL' AND p.roles @> ARRAY['anon','authenticated']::name[]
      AND p.roles <@ ARRAY['anon','authenticated']::name[]
      AND p.qual='(bucket_id <> ''interior-site-evidence''::text)'
      AND p.with_check='(bucket_id <> ''interior-site-evidence''::text)') THEN
    RAISE EXCEPTION 'P4 Storage policy differs from reviewed definition';
  END IF;
END;
$$;
DROP POLICY interior_site_evidence_no_direct_client_access ON storage.objects;
COMMIT;
