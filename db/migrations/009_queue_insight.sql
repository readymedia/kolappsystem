-- 009_queue_insight: kø-innsikt (v1.8). Bare tillegg; alt nytt er av som standard.

-- «Vis køen før gjesten tar lapp» (standard av = lapp med en gang, som før).
ALTER TABLE site_config ADD COLUMN confirm_join boolean NOT NULL DEFAULT false;
-- Ventetid som varighet (som før), klokkeslett eller begge.
ALTER TABLE site_config ADD COLUMN wait_display text NOT NULL DEFAULT 'duration'
  CHECK (wait_display IN ('duration', 'clock', 'both'));

-- Sluttid (siste betjening, norsk tid) og maks antall i kø per stasjon. Tomt = ingen grense (som før).
ALTER TABLE stations ADD COLUMN service_end time;
ALTER TABLE stations ADD COLUMN max_waiting integer CHECK (max_waiting IS NULL OR max_waiting BETWEEN 1 AND 10000);

-- Sammendrag per stasjon og runde, lagret rett før nullstilling (rapporten). Bare tall – ingen persondata.
CREATE TABLE station_stats (
  id                 serial      PRIMARY KEY,
  station            text        NOT NULL,
  station_label      text        NOT NULL,
  started_at         timestamptz,
  ended_at           timestamptz NOT NULL DEFAULT now(),
  issued             integer     NOT NULL,
  served             integer     NOT NULL,
  skipped            integer     NOT NULL,
  left_count         integer     NOT NULL,
  waiting            integer     NOT NULL,
  avg_wait_seconds   integer,
  max_wait_seconds   integer,
  minutes_per_person numeric(4,1),
  busiest_hour       text
);
CREATE INDEX station_stats_ended ON station_stats (ended_at DESC);
