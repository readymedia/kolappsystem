-- 001_init: grunnskjema for kølappsystemet.
-- Kjøres automatisk av scripts/migrate.mjs (også ved hver Vercel-bygging). Endre aldri en
-- migrering som er kjørt i produksjon; lag heller en ny fil (002_...sql).

CREATE TABLE stations (
  id          text PRIMARY KEY CHECK (id IN ('A', 'B', 'C')),
  description text        NOT NULL DEFAULT '',
  active      boolean     NOT NULL DEFAULT true,
  -- Hemmelig nøkkel i QR-lenken. Leses KUN av admin-endepunkter og /api/join.
  join_key    text        NOT NULL,
  -- Neste nummer som deles ut. Økes atomisk i samme transaksjon som lappen lages.
  next_number integer     NOT NULL DEFAULT 1 CHECK (next_number >= 1),
  -- Økes ved nullstilling. Lapper fra en eldre generasjon regnes som ugyldige.
  generation  integer     NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE ticket_status AS ENUM ('waiting', 'called', 'done', 'skipped');

CREATE TABLE tickets (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  station     text          NOT NULL REFERENCES stations (id),
  number      integer       NOT NULL CHECK (number >= 1),
  generation  integer       NOT NULL,
  status      ticket_status NOT NULL DEFAULT 'waiting',
  created_at  timestamptz   NOT NULL DEFAULT now(),
  called_at   timestamptz,
  finished_at timestamptz,
  -- Siste skanse mot duplikater: samme nummer kan aldri finnes to ganger i samme generasjon.
  UNIQUE (station, generation, number)
);

-- Maks én lapp kalt per stasjon om gangen.
CREATE UNIQUE INDEX tickets_one_called_per_station ON tickets (station) WHERE status = 'called';
CREATE INDEX tickets_station_status_number ON tickets (station, status, number);

-- Logg over NESTE / Hopp over, brukt av «Angre siste» (flere steg).
CREATE TABLE queue_actions (
  id              bigserial   PRIMARY KEY,
  station         text        NOT NULL REFERENCES stations (id),
  kind            text        NOT NULL CHECK (kind IN ('next', 'skip')),
  finished_ticket uuid,
  called_ticket   uuid,
  undone          boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX queue_actions_station_open ON queue_actions (station, id DESC) WHERE NOT undone;

-- Én rad med innstillinger.
CREATE TABLE settings (
  id             integer     PRIMARY KEY CHECK (id = 1),
  -- scrypt-hash av PIN-koden (aldri klartekst).
  pin_hash       text        NOT NULL,
  -- Økes når PIN byttes; alle eldre økter blir da ugyldige.
  pin_version    integer     NOT NULL DEFAULT 1,
  -- Reserve-hemmelighet for økter når SESSION_SECRET ikke er satt.
  session_secret text        NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Enkle forsøksgrenser (fast tidsvindu) for PIN-innlogging og nye kølapper.
CREATE TABLE rate_limits (
  key          text        PRIMARY KEY,
  count        integer     NOT NULL,
  window_start timestamptz NOT NULL
);
