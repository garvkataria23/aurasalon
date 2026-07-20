CREATE TRIGGER IF NOT EXISTS trg_membership_audit_no_update
BEFORE UPDATE ON membership_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'membership audit logs are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_membership_audit_no_delete
BEFORE DELETE ON membership_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'membership audit logs are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_client_membership_ledger_no_update
BEFORE UPDATE ON client_membership_ledger
BEGIN
  SELECT RAISE(ABORT, 'client membership ledger is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_client_membership_ledger_no_delete
BEFORE DELETE ON client_membership_ledger
BEGIN
  SELECT RAISE(ABORT, 'client membership ledger is immutable');
END;
