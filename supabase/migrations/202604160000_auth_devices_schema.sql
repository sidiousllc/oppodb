-- Auth users table
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  active BOOLEAN DEFAULT true
);

-- User groups
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6366f1',
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES user_groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- User API keys
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Device labels
CREATE TABLE IF NOT EXISTS device_labels (
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, user_id)
);

-- Device settings
CREATE TABLE IF NOT EXISTS device_settings (
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  tracking_enabled BOOLEAN DEFAULT true,
  notify_radius INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, user_id)
);

-- Location data with user association
ALTER TABLE location_data ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_device_labels_user ON device_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_location_data_user ON location_data(user_id);

-- Insert default admin user (password: OppoDB2026!)
INSERT INTO auth_users (email, password_hash, role) 
VALUES ('admin@oppodb.com', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert default groups
INSERT INTO user_groups (name, color, permissions) VALUES 
('Administrators', '#EF4444', '["admin", "users", "api_keys", "devices"]'),
('Trackers', '#10B981', '["view_devices", "create_keys"]'),
('Viewers', '#6366F1', '["view_devices"]')
ON CONFLICT (name) DO NOTHING;
