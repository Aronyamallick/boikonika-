-- Keeps updated_at correct even for raw SQL updates that bypass the ORM.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at' AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$I', r.table_name);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', r.table_name);
  END LOOP;
END $$;
--> statement-breakpoint
-- Replies are comments with a parent; exposed as a view for reporting and readability.
CREATE OR REPLACE VIEW comment_replies AS
  SELECT id, post_id, parent_id, author_id, body, status, like_count, created_at, updated_at
  FROM comments
  WHERE parent_id IS NOT NULL;
--> statement-breakpoint
-- Guard rail: a stock movement may never be edited or deleted (append-only ledger).
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_inventory_movements_append_only BEFORE UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_kyc_events_append_only BEFORE UPDATE OR DELETE ON kyc_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
