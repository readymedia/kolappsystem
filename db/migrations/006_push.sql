-- 006_push: push-varsel på kølappen (v1.5). Bare tillegg. Av som standard.

-- Admin-bryter. Av = ingen knapp for publikum og ingen utsending.
ALTER TABLE site_config ADD COLUMN push_enabled boolean NOT NULL DEFAULT false;

-- VAPID-nøkler (Web Push). Lages av scripts/migrate.mjs. Privatnøkkelen er hemmelig (som session_secret).
ALTER TABLE settings ADD COLUMN vapid_public text;
ALTER TABLE settings ADD COLUMN vapid_private text;

-- Ett abonnement per lapp og nettleser. Slettes automatisk med lappen.
CREATE TABLE push_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  -- Siste varsel som er sendt (hindrer dobbel utsending): next = «nest i køen», called = «din tur», skipped.
  last_kind   text        CHECK (last_kind IN ('next', 'called', 'skipped')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, endpoint)
);
CREATE INDEX push_subscriptions_ticket ON push_subscriptions (ticket_id);
