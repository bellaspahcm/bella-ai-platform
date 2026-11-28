-- Restrict public approval reads to unexpired capabilities.
-- Production applied the captured full definitions. This portable source form
-- modifies only the lookup predicate and fails closed on unexpected definitions.
DO $migration$
DECLARE
  item record;
  definition text;
  old_predicate text;
  new_predicate text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('public.interior_read_public_customer_approval(uuid,uuid)', 'a'),
      ('public.interior_read_public_customer_addendum_approval(uuid,uuid)', 'a'),
      ('public.interior_read_public_handover_acceptance(uuid,uuid)', 'r')
    ) AS functions(signature, alias_name)
  LOOP
    IF to_regprocedure(item.signature) IS NULL THEN
      RAISE EXCEPTION 'Required function missing: %', item.signature;
    END IF;
    definition := pg_get_functiondef(to_regprocedure(item.signature));
    old_predicate := format('WHERE %1$s.id = p_approval_id AND %1$s.approval_token = p_approval_token', item.alias_name);
    new_predicate := old_predicate || format(' AND %s.expires_at > statement_timestamp()', item.alias_name);
    IF position(new_predicate IN definition) > 0
       OR position(old_predicate || E'\n    AND ' || item.alias_name || '.expires_at > statement_timestamp()' IN definition) > 0 THEN
      CONTINUE;
    END IF;
    IF (length(definition) - length(replace(definition, old_predicate, ''))) / length(old_predicate) <> 1 THEN
      RAISE EXCEPTION 'Unexpected function definition: %', item.signature;
    END IF;
    EXECUTE replace(definition, old_predicate, new_predicate);
  END LOOP;
END;
$migration$;

