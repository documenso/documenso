# heimWatt-Fork von Documenso

Dieses Repository ist der Fork `rubensyv/documenso` von `documenso/documenso`.
Er läuft als Cloud-Run-Dienst `documenso` (Projekt `heimwatt-app-ffe6c`,
`europe-west3`, Domain `esign.heim-watt.de`) und wird ausschließlich als
Embed im Beratungsprotokoll (Repo `esign`, Lib `@heimwatt/document-signing`)
benutzt.

Diese Seite ist das **Register aller Abweichungen vom Upstream**. Wer den
Fork aktualisiert oder etwas ändert, pflegt sie mit — sie ist die Stelle, die
man in sechs Monaten zuerst aufschlägt.

## Leitlinien (wartungsarm)

1. **Isolieren statt einflechten.** Eigener Code liegt in `heimwatt/`-Ordnern
   (`apps/remix/app/components/embed/heimwatt/`, `packages/lib/heimwatt/`).
   In Upstream-Dateien gibt es nur kleine, mit `// heimWatt:` markierte
   Stellen — `git grep "heimWatt"` findet sie alle.
2. **Schalter statt Rebuild.** Features hängen an `NEXT_PUBLIC_*`-Env-Variablen,
   die Documenso zur Laufzeit liest (`window.__ENV__`). Umschalten = Cloud-Run-
   Env ändern (über Terraform, Backend-Repo `infra/terraform/modules/documenso`),
   kein Image-Build. Default aus = exakt Upstream-Verhalten.
3. **Upstream-Dateien nur additiv anfassen** (optionale Props, ein Block),
   damit `git merge` beim nächsten Release höchstens an bekannten Stellen
   stolpert.
4. **Übersetzungen** nur für `de` pflegen (`packages/lib/translations/de/web.po`,
   dazu der `en`-Quelleintrag). Andere Sprachen fallen auf Englisch zurück.
   Kein komplettes `lingui extract` committen — die Upstream-Kataloge sind
   gegenüber dem Quellcode veraltet, ein Voll-Extract erzeugt tausende
   Diff-Zeilen. Neue Einträge von Hand an der sortierten Stelle eintragen
   (Sortierung: `Intl.Collator("en-US")` auf msgid, dann msgctxt); der
   Docker-Build extrahiert und kompiliert ohnehin selbst (`apps/remix/.bin/build.sh`).

## Abweichungen vom Upstream

| Bereich | Dateien | Zweck | Prüfen nach Upstream-Merge |
|---|---|---|---|
| Deploy | `.github/workflows/deploy-documenso.yml` | Push auf `main` → Image-Build → Cloud Run (Prod, kein Staging). `workflow_dispatch` mit Haken **preview** → Revision ohne Traffic unter Tag `preview`. | Läuft der Workflow noch durch? (`docker/Dockerfile`-Pfad, Build-Skript) |
| Geführte Mobile-Signatur | `apps/remix/app/components/embed/heimwatt/guided-signing-bar.tsx`, `packages/lib/heimwatt/guided-signing.ts` (+ `.test.ts`) | Unter `md` ersetzt eine Leiste mit drei Schritten (Unterschrift zeichnen → Feld x von n antippen → Abschließen) das aufklappbare Documenso-Widget; Auto-Scroll zum nächsten Feld. Desktop unverändert. | Embed auf dem Handy öffnen: Leiste sichtbar, drei Schritte durchlaufbar |
| ↳ Einhängepunkt | `apps/remix/app/components/embed/embed-document-signing-page-v1.tsx` (Block `// heimWatt:`) | Rendert die Leiste, blendet das Widget unter `md` aus, wenn sie aktiv ist. | Merge-Konflikt hier möglich; Block nach dem Merge sinngemäß wieder einsetzen |
| ↳ Signatur-Dialog | `packages/ui/primitives/signature-pad/signature-pad-dialog.tsx` (Props `open`/`onOpenChange`/`hideTrigger`) | Leiste öffnet das Pad von ihrem eigenen Knopf aus. Ohne die Props = Upstream-Verhalten. | Props noch vorhanden? Dialog-Block wurde in `const dialog` ausgelagert |
| ↳ Übersetzungen | `packages/lib/translations/{de,en}/web.po` | Deutsche Texte der Leiste (9 Einträge, Quelle `guided-signing-bar.tsx`). | `npm run translate:compile` ohne Fehler; deutsche Texte im Embed sichtbar |

### Env-Schalter

| Variable | Wirkung | Gesetzt in |
|---|---|---|
| `NEXT_PUBLIC_HEIMWATT_GUIDED_SIGNING` | `"true"` → geführte Mobile-Signatur an; alles andere → Upstream-Widget | Terraform, Backend-Repo `infra/terraform/modules/documenso/main.tf` (Variable `guided_signing_enabled`) |

Notfall-Rollback ohne Terraform (danach Terraform nachziehen, sonst Drift):

```bash
gcloud run services update documenso --project heimwatt-app-ffe6c --region europe-west3 \
  --update-env-vars NEXT_PUBLIC_HEIMWATT_GUIDED_SIGNING=false
```

Ebenfalls nur per Datenbank gesetzt (kein Code): `OrganisationClaim.flags.hidePoweredBy = true`
und `embedSigningWhiteLabel` (Cloud-Run-Job `documenso-set-claim-flags`).

## Upstream-Release einspielen

```bash
git fetch upstream --tags
git switch -c chore/sync-vX.Y.Z origin/main
git merge vX.Y.Z            # Konflikte erwartet in: embed-document-signing-page-v1.tsx,
                            # signature-pad-dialog.tsx, ggf. web.po (de/en)
npm ci && (cd packages/prisma && npx prisma generate)
(cd packages/lib && npx vitest run heimwatt)          # Schritt-Logik
(cd apps/remix && npm run typecheck)
npm run translate:compile                              # Kataloge kompilieren (nicht extract committen)
```

Danach die Spalte „Prüfen nach Upstream-Merge" der Tabelle abarbeiten, PR öffnen,
per `workflow_dispatch` + **preview** eine Revision ohne Traffic bauen und mit
einem echten Embed-Link (Staging-Session des Beratungsprotokolls, Host auf die
Preview-URL getauscht) auf dem Handy prüfen. Erst dann mergen.

## Preview-Deploy

Actions → „Deploy Documenso" → *Run workflow* → Branch wählen → Haken **preview**.
Ergebnis: Revision ohne Traffic, URL `https://preview---documenso-isexjmthjq-ey.a.run.app`.
Ein Embed-Link `https://esign.heim-watt.de/embed/sign/<token>#…` funktioniert dort
1:1 mit getauschtem Host. Prod bleibt unberührt; der nächste Push auf `main` (oder
`gcloud run services update-traffic documenso --region europe-west3 --to-latest`)
gibt den Stand frei.
