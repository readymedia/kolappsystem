-- 003_site_config_media: felles grunnmur for innstillinger og opplastede filer (v1.2).
-- Bare tillegg: eldre kode bruker ikke disse tabellene og påvirkes ikke.

-- Opplastede filer (lyd i v1.2, logo i v1.4). Lagres i databasen, serveres via /api/media/<sha256>.
CREATE TABLE media (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text        NOT NULL CHECK (kind IN ('audio', 'logo')),
  mime       text        NOT NULL,
  bytes      bytea       NOT NULL,
  size       integer     NOT NULL CHECK (size > 0),
  sha256     text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Én rad med innstillinger som kan endres i /admin. Nye innstillinger legges til som kolonner
-- med standardverdier i senere migreringer, slik at standard alltid = dagens oppførsel.
CREATE TABLE site_config (
  id             integer     PRIMARY KEY CHECK (id = 1),
  audio_mode     text        NOT NULL DEFAULT 'default' CHECK (audio_mode IN ('default', 'custom', 'off')),
  audio_volume   integer     NOT NULL DEFAULT 80 CHECK (audio_volume BETWEEN 0 AND 100),
  audio_media_id uuid        REFERENCES media (id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
