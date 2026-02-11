# Deploying Documenso to Render (Render Postgres)

This guide deploys Documenso to Render using **Render Postgres** as the database. The Blueprint creates the database and wires it to both the main app and token-exchange service.

**Production URL:** `https://sign.pinogy.com`

## 1. Deploy with the Blueprint (Recommended)

1. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint**.
2. Connect your GitHub account if needed, then select the **documenso** repository.
3. Render reads `render.yaml` and creates:
   - **documenso-db** – Render Postgres (free tier)
   - **documenso-app** – Main web app
   - **token-exchange** – API token exchange service for mobile apps

4. Database URLs are injected automatically. In the **documenso-app** Environment tab, set:
   - `NEXTAUTH_URL` → `https://sign.pinogy.com` (or your service URL until domain is set)
   - `NEXT_PUBLIC_WEBAPP_URL` → same
   - `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` → same
   - All other required vars from step 2 below.

5. Click **Apply** to create the resources.

## 2. Required Environment Variables

Set these in the **Environment** section of each service. Use `https://sign.pinogy.com` for all URL vars once the custom domain is set.

### documenso-app (main app)

| Key | Value | Notes |
|-----|--------|------|
| `NEXTAUTH_SECRET` | A long random string | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://sign.pinogy.com` | Set after custom domain |
| `NEXT_PUBLIC_WEBAPP_URL` | `https://sign.pinogy.com` | |
| `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` | `https://sign.pinogy.com` | |
| `NEXT_PRIVATE_DATABASE_URL` | *(auto from Blueprint)* | Injected from documenso-db |
| `NEXT_PRIVATE_DIRECT_DATABASE_URL` | *(auto from Blueprint)* | Injected from documenso-db |
| `NEXT_PRIVATE_ENCRYPTION_KEY` | Random string, at least 32 chars | |
| `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` | Another random string, 32+ chars | |

### token-exchange (optional, for mobile apps)

| Key | Value |
|-----|--------|
| `TOKEN_EXCHANGE_SECRET` | Generate with `openssl rand -base64 32` |
| `NEXT_PRIVATE_DATABASE_URL` | *(auto from Blueprint)* |
| `NEXT_PRIVATE_DIRECT_DATABASE_URL` | *(auto from Blueprint)* |

### Optional (can add later)

- **SMTP** (for emails): `NEXT_PRIVATE_SMTP_TRANSPORT`, `NEXT_PRIVATE_SMTP_HOST`, `NEXT_PRIVATE_SMTP_PORT`, `NEXT_PRIVATE_SMTP_USERNAME`, `NEXT_PRIVATE_SMTP_PASSWORD`, `NEXT_PRIVATE_SMTP_FROM_NAME`, `NEXT_PRIVATE_SMTP_FROM_ADDRESS`.
- **Google OAuth**: `NEXT_PRIVATE_GOOGLE_CLIENT_ID`, `NEXT_PRIVATE_GOOGLE_CLIENT_SECRET`.
- **Stripe** (billing): `NEXT_PRIVATE_STRIPE_API_KEY`, `NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET`.

## 3. Deployment Flow

1. Blueprint creates **documenso-db** (Render Postgres) first.
2. Migrations run via the start command: `npx prisma migrate deploy`.
3. The app starts and connects to the database over Render’s internal network.

## 4. Custom Domain (sign.pinogy.com)

1. In Render: **Settings** → **Custom Domains** → **Add Custom Domain**.
2. Enter `sign.pinogy.com` and follow Render’s instructions (add the CNAME or A record they show).
3. Ensure `NEXTAUTH_URL`, `NEXT_PUBLIC_WEBAPP_URL`, and `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` are all `https://sign.pinogy.com` in **Environment**.
4. Run **Manual Deploy** (Deploys → Deploy latest commit) so the app uses the correct URL.

## 5. Using a Manual Setup Instead of Blueprint

If you prefer not to use the Blueprint:

1. **New +** → **PostgreSQL**.
2. Create a database (e.g. `documenso-db`), plan **Free**.
3. **New +** → **Web Service**.
4. Connect the repo, set:
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npx prisma migrate deploy --schema packages/prisma/schema.prisma && (cd apps/remix && node build/server/main.js)`
   - **Health Check Path**: `/api/health`
5. In Environment, add:
   - `NEXT_PRIVATE_DATABASE_URL` → **Internal Database URL** from the Postgres Connect menu
   - `NEXT_PRIVATE_DIRECT_DATABASE_URL` → same
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_WEBAPP_URL`, `NEXT_PRIVATE_INTERNAL_WEBAPP_URL`
   - `NEXT_PRIVATE_ENCRYPTION_KEY`, `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY`

6. For **token-exchange**, create another Web Service and set:
   - Build: `npm ci && npm run build --filter=@documenso/token-exchange`
   - Start: `cd apps/token-exchange && npm run start`
   - Same database URLs as the main app.

## 6. Troubleshooting

- **Build fails**: Ensure **Build Command** is exactly `npm ci && npm run build` and **Root Directory** is empty.
- **Migrations fail**: Confirm the database is running and the URL is the **Internal Database URL** (not external) for the same region.
- **502 / app not starting**: Check the **Logs** tab. Ensure all required env vars are set, especially `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and both database URLs.
- **Free instance sleeps**: On the free plan, the service sleeps after inactivity. The first request after sleep can take 30–60 seconds to respond.
- **Connection pool**: Render Postgres free tier has limited connections. The app uses `connection_limit=5` by default; if you hit limits, set `DATABASE_CONNECTION_LIMIT=3` in the environment.
