-- 004_display: skjerminnstillinger (v1.3). Bare tillegg med standard = dagens oppførsel.

-- Overskriften på storskjermen. Tom tekst skjuler topplinjen.
ALTER TABLE site_config ADD COLUMN display_title text NOT NULL DEFAULT 'Meet & Greet · Køstatus';

-- Valgfri melding til publikum når en stasjon er stengt (f.eks. «Tilbake kl. 14.00»). Offentlig.
ALTER TABLE stations ADD COLUMN closed_message text NOT NULL DEFAULT '';
