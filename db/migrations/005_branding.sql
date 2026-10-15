-- 005_branding: utseende per arrangement (v1.4). Bare tillegg med standard = dagens utseende.

ALTER TABLE site_config ADD COLUMN event_name text NOT NULL DEFAULT 'Meet & Greet';
ALTER TABLE site_config ADD COLUMN logo_media_id uuid REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE site_config ADD COLUMN primary_color text NOT NULL DEFAULT '#0f172a'
  CHECK (primary_color ~ '^#[0-9a-f]{6}$');
ALTER TABLE site_config ADD COLUMN display_background text NOT NULL DEFAULT 'dark'
  CHECK (display_background IN ('dark', 'light'));
ALTER TABLE site_config ADD COLUMN font_display text NOT NULL DEFAULT 'space-grotesk';
ALTER TABLE site_config ADD COLUMN font_body text NOT NULL DEFAULT 'inter';
