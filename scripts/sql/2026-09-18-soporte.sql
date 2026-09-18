-- Módulo de soporte: agentes, gestión de casos, conversación y evidencias.
-- Idempotente y en una sola sentencia (la consola SQL de Replit ejecuta solo
-- la última sentencia del editor).
DO $$
BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS support_agent boolean NOT NULL DEFAULT false;
  ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS assigned_to uuid;
  ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS access_token text;
  ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
  ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS last_message_at timestamptz;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_requests_assigned_to_users_id_fk') THEN
    ALTER TABLE support_requests ADD CONSTRAINT support_requests_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  CREATE TABLE IF NOT EXISTS support_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
    author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    author_name text NOT NULL,
    author_role text NOT NULL DEFAULT 'requester',
    body text NOT NULL,
    internal boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS support_messages_request_idx ON support_messages (request_id);
  CREATE TABLE IF NOT EXISTS support_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
    message_id uuid REFERENCES support_messages(id) ON DELETE SET NULL,
    s3_key text NOT NULL,
    file_name text NOT NULL,
    content_type text NOT NULL,
    size_bytes integer NOT NULL,
    uploaded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    uploaded_by_name text NOT NULL,
    uploaded_by_role text NOT NULL DEFAULT 'requester',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS support_attachments_request_idx ON support_attachments (request_id);
END $$;
