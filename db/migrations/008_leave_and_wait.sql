-- 008_leave_and_wait: gi fra seg plassen og ventetid (v1.7). Bare tillegg.

-- Ny lappstatus: gjesten har gitt fra seg plassen. (Brukes først etter at migreringen er ferdig.)
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'left';
ALTER TABLE tickets ADD COLUMN left_at timestamptz;

-- Admin: «Gjester kan gi fra seg plassen» (standard på, bestiller 15.10).
ALTER TABLE site_config ADD COLUMN allow_leave boolean NOT NULL DEFAULT true;
-- Ventetid som vises: fast antall minutter per person (standard 2 = som før) eller faktisk tempo.
ALTER TABLE site_config ADD COLUMN wait_mode text NOT NULL DEFAULT 'fixed' CHECK (wait_mode IN ('fixed', 'measured'));
ALTER TABLE site_config ADD COLUMN wait_minutes numeric(4,1) NOT NULL DEFAULT 2 CHECK (wait_minutes >= 0.5 AND wait_minutes <= 60);
