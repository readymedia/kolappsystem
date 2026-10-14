-- 002_robust_join: vern mot dobbeltlapper og flom av falske lapper.

-- Klienten sender en tilfeldig request_id per skann. Gjentas samme forespørsel (f.eks. fordi svaret
-- ble borte på dårlig nett), returneres samme lapp i stedet for en ny.
ALTER TABLE tickets ADD COLUMN request_id uuid;
CREATE UNIQUE INDEX tickets_request_id ON tickets (station, generation, request_id) WHERE request_id IS NOT NULL;

-- HMAC av klientens IP-adresse (aldri selve adressen). Brukes til å begrense antall ventende lapper
-- per nettverk og til å kunne rydde bort lapper fra én kilde.
ALTER TABLE tickets ADD COLUMN ip_hash text;
CREATE INDEX tickets_waiting_ip ON tickets (station, generation, ip_hash) WHERE status = 'waiting';

-- Angre-logg: skal kunne sammenlignes med hva operatøren så (vern mot dobbelt trykk på «Angre»).
CREATE INDEX IF NOT EXISTS queue_actions_station_id ON queue_actions (station, id DESC);
