-- ─────────────────────────────────────────────────────────────────
-- Row-Level Security for per-agency data isolation
-- Applied AFTER Prisma creates the tables (run as a separate migration step)
-- ─────────────────────────────────────────────────────────────────

-- Enable RLS on all tenant-scoped tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_coverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE diff_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE signoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- Create the app role used by the application (not the superuser)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'policydiff_app') THEN
    CREATE ROLE policydiff_app LOGIN PASSWORD 'changeme';
  END IF;
END
$$;

-- Grant basic permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO policydiff_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO policydiff_app;

-- ── RLS Policies ────────────────────────────────────────────────
-- The app sets `current_setting('app.current_agency_id')` on each
-- database connection via Prisma's `$executeRaw` before queries.

-- agencies: users can only see their own agency
CREATE POLICY agency_isolation ON agencies
  USING (id = current_setting('app.current_agency_id', true));

-- users: scoped to agency
CREATE POLICY user_agency_isolation ON users
  USING (agency_id = current_setting('app.current_agency_id', true));

-- policy_checks: scoped to agency
CREATE POLICY policy_check_agency_isolation ON policy_checks
  USING (agency_id = current_setting('app.current_agency_id', true));

-- documents: scoped via policy_check
CREATE POLICY document_agency_isolation ON documents
  USING (
    policy_check_id IN (
      SELECT id FROM policy_checks
      WHERE agency_id = current_setting('app.current_agency_id', true)
    )
  );

-- extracted_coverages: scoped via policy_check
CREATE POLICY coverage_agency_isolation ON extracted_coverages
  USING (
    policy_check_id IN (
      SELECT id FROM policy_checks
      WHERE agency_id = current_setting('app.current_agency_id', true)
    )
  );

-- diff_items: scoped via policy_check
CREATE POLICY diff_agency_isolation ON diff_items
  USING (
    policy_check_id IN (
      SELECT id FROM policy_checks
      WHERE agency_id = current_setting('app.current_agency_id', true)
    )
  );

-- signoffs: scoped via policy_check
CREATE POLICY signoff_agency_isolation ON signoffs
  USING (
    policy_check_id IN (
      SELECT id FROM policy_checks
      WHERE agency_id = current_setting('app.current_agency_id', true)
    )
  );

-- audit_log: scoped to agency (append-only enforced at app level)
CREATE POLICY audit_agency_isolation ON audit_log
  USING (
    current_setting('app.is_superadmin', true) = 'true' OR
    agency_id = current_setting('app.current_agency_id', true)
  );

-- subscriptions: scoped to agency or superadmin
CREATE POLICY subscription_agency_isolation ON subscriptions
  USING (
    current_setting('app.is_superadmin', true) = 'true' OR
    agency_id = current_setting('app.current_agency_id', true)
  );

-- invoices: scoped to agency or superadmin
CREATE POLICY invoice_agency_isolation ON invoices
  USING (
    current_setting('app.is_superadmin', true) = 'true' OR
    agency_id = current_setting('app.current_agency_id', true)
  );

-- invoice_payments: scoped via invoice or superadmin
CREATE POLICY invoice_payment_agency_isolation ON invoice_payments
  USING (
    current_setting('app.is_superadmin', true) = 'true' OR
    invoice_id IN (
      SELECT id FROM invoices
      WHERE agency_id = current_setting('app.current_agency_id', true)
    )
  );
