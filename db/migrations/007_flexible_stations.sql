-- 007_flexible_stations: fritt antall stasjoner (v1.6). Bare tillegg; A, B og C beholder alt.

-- Stasjonskode: én bokstav A–Z (tildeles automatisk, endres aldri – står i QR og på lappene).
ALTER TABLE stations DROP CONSTRAINT stations_id_check;
ALTER TABLE stations ADD CONSTRAINT stations_id_check CHECK (id ~ '^[A-Z]$');

-- Valgfritt navn (tomt = «Stasjon A»), farge (palett-navn eller #rrggbb), rekkefølge og arkivering.
ALTER TABLE stations ADD COLUMN name text NOT NULL DEFAULT '' CHECK (char_length(name) <= 40);
ALTER TABLE stations ADD COLUMN color text NOT NULL DEFAULT 'slate' CHECK (color ~ '^(#[0-9a-f]{6}|[a-z]+)$');
ALTER TABLE stations ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE stations ADD COLUMN archived_at timestamptz;
ALTER TABLE stations ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

-- Dagens stasjoner får dagens farger og rekkefølge.
UPDATE stations SET
  color = CASE id WHEN 'A' THEN 'sky' WHEN 'B' THEN 'violet' WHEN 'C' THEN 'emerald' ELSE color END,
  sort_order = ascii(id) - 64;

CREATE INDEX stations_active_order ON stations (sort_order) WHERE archived_at IS NULL;
