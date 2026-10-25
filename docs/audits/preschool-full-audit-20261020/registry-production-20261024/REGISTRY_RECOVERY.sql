-- Exact package-owned configuration only. Abort if used by any other source.
BEGIN;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';SET LOCAL search_path=pg_catalog,public;
LOCK TABLE public.org_relationships IN SHARE ROW EXCLUSIVE MODE;
SELECT id FROM public.org_units WHERE id='341b519a-6206-4b50-94c5-9fe9ef71a1fc' FOR UPDATE;
SELECT id FROM public.people_directory WHERE id='1f6ee2f2-1a69-423a-b659-41d2639e3ec6' FOR UPDATE;
DO $ownership$ DECLARE fk record;used boolean; BEGIN
IF EXISTS(SELECT 1 FROM public.preschool_chain_course_branch_assignments WHERE tenant_id<>'ed100000-0000-0000-0000-000000000001' OR branch_id<>'341b519a-6206-4b50-94c5-9fe9ef71a1fc' OR assigned_by IS DISTINCT FROM 'ad6899c2-4b9d-49af-acb3-69e2e1d11447'::uuid OR course_id NOT IN('ed100000-c001-0000-0000-000000000001','ed100000-c002-0000-0000-000000000002','ed100000-c003-0000-0000-000000000003','ed100000-c004-0000-0000-000000000004','ed100000-c005-0000-0000-000000000005','ed100000-c006-0000-0000-000000000006','ed100000-c007-0000-0000-000000000007','ed100000-c008-0000-0000-000000000008')) THEN RAISE EXCEPTION 'REGISTRY_RECOVERY_SCOPE_DRIFT';END IF;
IF (SELECT count(*) FROM public.org_units WHERE id='341b519a-6206-4b50-94c5-9fe9ef71a1fc' AND tenant_id='ed100000-0000-0000-0000-000000000001' AND code='AD-CS01' AND metadata->>'registryPackage'='20261024')<>1 OR (SELECT count(*) FROM public.people_directory WHERE id='1f6ee2f2-1a69-423a-b659-41d2639e3ec6' AND tenant_id='ed100000-0000-0000-0000-000000000001' AND user_id='ad6899c2-4b9d-49af-acb3-69e2e1d11447')<>1 THEN RAISE EXCEPTION 'REGISTRY_RECOVERY_OWNERSHIP';END IF;
IF (SELECT count(*) FROM public.org_relationships WHERE id='4bff4932-38d0-4677-bcac-0d123a09ce4c' AND tenant_id='ed100000-0000-0000-0000-000000000001' AND from_id='1f6ee2f2-1a69-423a-b659-41d2639e3ec6' AND from_type='person' AND to_id='341b519a-6206-4b50-94c5-9fe9ef71a1fc' AND to_type='unit' AND rel_type='manages' AND metadata->>'registryPackage'='20261024')<>1 THEN RAISE EXCEPTION 'REGISTRY_RELATIONSHIP_DRIFT';END IF;
IF EXISTS(SELECT 1 FROM public.org_relationships WHERE id<>'4bff4932-38d0-4677-bcac-0d123a09ce4c' AND (from_id IN('1f6ee2f2-1a69-423a-b659-41d2639e3ec6','341b519a-6206-4b50-94c5-9fe9ef71a1fc') OR to_id IN('1f6ee2f2-1a69-423a-b659-41d2639e3ec6','341b519a-6206-4b50-94c5-9fe9ef71a1fc'))) THEN RAISE EXCEPTION 'REGISTRY_CONFIGURATION_IN_USE';END IF;
FOR fk IN SELECT c.conrelid::regclass::text relation,a.attname column_name,CASE WHEN c.confrelid='public.org_units'::regclass THEN '341b519a-6206-4b50-94c5-9fe9ef71a1fc'::uuid ELSE '1f6ee2f2-1a69-423a-b659-41d2639e3ec6'::uuid END target FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey,c.confkey) k(local_key,foreign_key) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.local_key JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=k.foreign_key WHERE c.contype='f' AND c.confrelid IN('public.org_units'::regclass,'public.people_directory'::regclass) AND b.attname='id' AND c.conrelid<>'public.preschool_chain_course_branch_assignments'::regclass LOOP
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE %I=$1)',fk.relation,fk.column_name) INTO used USING fk.target;
 IF used THEN RAISE EXCEPTION 'REGISTRY_CONFIGURATION_IN_USE';END IF;
END LOOP;
END $ownership$;
DROP FUNCTION public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer);
DROP TABLE public.preschool_chain_course_branch_assignments;
DELETE FROM public.org_relationships WHERE id='4bff4932-38d0-4677-bcac-0d123a09ce4c' AND tenant_id='ed100000-0000-0000-0000-000000000001' AND from_id='1f6ee2f2-1a69-423a-b659-41d2639e3ec6' AND to_id='341b519a-6206-4b50-94c5-9fe9ef71a1fc';
DELETE FROM public.people_directory WHERE id='1f6ee2f2-1a69-423a-b659-41d2639e3ec6' AND tenant_id='ed100000-0000-0000-0000-000000000001' AND user_id='ad6899c2-4b9d-49af-acb3-69e2e1d11447';
DELETE FROM public.org_units WHERE id='341b519a-6206-4b50-94c5-9fe9ef71a1fc' AND tenant_id='ed100000-0000-0000-0000-000000000001' AND metadata->>'registryPackage'='20261024';
NOTIFY pgrst,'reload schema';ROLLBACK;
