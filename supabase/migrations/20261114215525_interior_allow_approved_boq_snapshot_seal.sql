-- A sealed snapshot timestamp is the only metadata mutation permitted on an approved/locked BOQ.
-- Keep all other row values immutable while the snapshot is sealed by the fork RPC.
CREATE OR REPLACE FUNCTION public.trg_guard_interior_boq_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('approved', 'locked_for_contract')
       AND OLD.snapshot_sealed_at IS NULL
       AND NEW.snapshot_sealed_at IS NOT NULL
       AND (to_jsonb(NEW) - 'snapshot_sealed_at' - 'updated_at')
           = (to_jsonb(OLD) - 'snapshot_sealed_at' - 'updated_at') THEN
        RETURN NEW;
    END IF;

    -- A locked BOQ remains immutable after its one allowed snapshot seal.
    IF OLD.status = 'locked_for_contract' THEN
        RAISE EXCEPTION 'Immutability violation: BOQ % is locked_for_contract and cannot be modified.', OLD.id;
    END IF;

    -- An approved BOQ may only be snapshot-sealed or transitioned to contract lock.
    IF OLD.status = 'approved' THEN
        IF NEW.status != 'locked_for_contract' THEN
            RAISE EXCEPTION 'Immutability violation: BOQ % is approved and cannot be updated to status %.', OLD.id, NEW.status;
        END IF;

        -- Strict invariant: no financial or identity tampering during the status transition.
        IF NEW.total_internal_cost != OLD.total_internal_cost
           OR NEW.total_client_price != OLD.total_client_price
           OR NEW.total_gross_margin != OLD.total_gross_margin
           OR NEW.gross_margin_percent != OLD.gross_margin_percent
           OR NEW.boq_number != OLD.boq_number
           OR NEW.version_number != OLD.version_number
           OR NEW.design_revision_id != OLD.design_revision_id
           OR NEW.project_id != OLD.project_id
           OR NEW.tenant_id != OLD.tenant_id THEN
            RAISE EXCEPTION 'Immutability violation: Cannot alter commercial figures or identities of approved BOQ % during contract locking.', OLD.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;
