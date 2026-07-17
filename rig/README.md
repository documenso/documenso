# Holostaff deployment rig

This fork is a Tier-2 target of the Holostaff deployment test rig
(holostaff-agent `documents/prd-test-rig.md`, P2). The rig force-resets
`main` to a pinned baseline before every run, opens real Holostaff
deploy + embed PRs against it, merges them, builds this compose stack
from the merged source, and drives simulated users at the running app.

`compose.yml` is the rig's serving stack (Postgres + Mailpit + the app
built from this checkout). Manual bring-up:

```sh
# one-time: self-signed signing cert (document signing needs a p12)
openssl genrsa -out /tmp/rig-doc.key 2048
openssl req -new -x509 -key /tmp/rig-doc.key -out /tmp/rig-doc.crt -days 365 \
  -subj "/CN=Holostaff Rig"
openssl pkcs12 -export -out "$HOME/.holostaff-rig/documenso-cert.p12" \
  -inkey /tmp/rig-doc.key -in /tmp/rig-doc.crt -passout pass:

RIG_APP_PORT=4180 \
RIG_PUBLIC_ORIGIN=http://localhost:4180 \
RIG_CERT_PATH="$HOME/.holostaff-rig/documenso-cert.p12" \
docker compose -f rig/compose.yml up -d --build
```

Seeding: the rig creates its user through the app's own signup endpoint
and then marks the email verified directly in Postgres (login requires a
verified email; SMTP lands in Mailpit at `127.0.0.1:8026`).
