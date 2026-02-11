# Deploying Documenso to Render (Supabase only)

This guide deploys Documenso to Render using **Supabase** as the database. Render’s Postgres is not used.

**Production URL:** `https://sign.pinogy.com`

## 1. Create a Web Service on Render

1. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Web Service**.
2. Connect your GitHub account if needed, then select the **documenso** repository.
3. Configure the service:
   - **Name**: e.g. `documenso-app` (or leave the default).
   - **Region**: Choose one close to your users.
   - **Branch**: `main` (or your default branch).
   - **Root Directory**: leave blank (repo root).
   - **Runtime**: **Node**.
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npx prisma migrate deploy --schema packages/prisma/schema.prisma && npx turbo run start --filter=@documenso/remix`
   - **Instance Type**: Free (or paid if you prefer).

4. Click **Advanced** and set:
   - **Health Check Path**: `/api/health` (optional but recommended).

## 2. Environment Variables

In the **Environment** section, add these variables. Use `https://sign.pinogy.com` for all URL vars once the custom domain is set (see step 4).

### Required

| Key | Value |
|-----|--------|
| `NEXTAUTH_SECRET` | A long random string (e.g. generate with `openssl rand -base64 32`). |
| `NEXTAUTH_URL` | `https://sign.pinogy.com` |
| `NEXT_PUBLIC_WEBAPP_URL` | `https://sign.pinogy.com` |
| `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` | `https://sign.pinogy.com` |
| `NEXT_PRIVATE_DATABASE_URL` | Your Supabase **connection pooler** URL (Transaction mode, port 6543). Use the **Session** pooler URL if you prefer. |
| `NEXT_PRIVATE_DIRECT_DATABASE_URL` | Your Supabase **direct** URL (Session mode pooler, port 5432) for migrations. **Important:** URL-encode any special characters in the password (e.g. `$` → `%24`). |
| `NEXT_PRIVATE_ENCRYPTION_KEY` | Random string, at least 32 characters. |
| `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` | Another random string, at least 32 characters. |

### Optional (can add later)

- **SMTP** (for emails): `NEXT_PRIVATE_SMTP_TRANSPORT`, `NEXT_PRIVATE_SMTP_HOST`, `NEXT_PRIVATE_SMTP_PORT`, `NEXT_PRIVATE_SMTP_USERNAME`, `NEXT_PRIVATE_SMTP_PASSWORD`, `NEXT_PRIVATE_SMTP_FROM_NAME`, `NEXT_PRIVATE_SMTP_FROM_ADDRESS`.
- **Google OAuth**: `NEXT_PRIVATE_GOOGLE_CLIENT_ID`, `NEXT_PRIVATE_GOOGLE_CLIENT_SECRET`.
- **Stripe** (billing): `NEXT_PRIVATE_STRIPE_API_KEY`, `NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET`.

Leave other vars from `.env.example` unset unless you need them.

## 3. Deploy

1. Click **Create Web Service**.
2. Render will clone the repo, run `npm ci && npm run build`, then start the app. The first deploy can take several minutes.
3. When the build finishes, open your service URL. You may need to run migrations on first run (the start command runs them automatically).

## 4. Custom domain (sign.pinogy.com)

1. In Render: **Settings** → **Custom Domains** → **Add Custom Domain**.
2. Enter `sign.pinogy.com` and follow Render’s instructions (add the CNAME or A record they show).
3. Ensure **NEXTAUTH_URL**, **NEXT_PUBLIC_WEBAPP_URL**, and **NEXT_PRIVATE_INTERNAL_WEBAPP_URL** are all `https://sign.pinogy.com` in **Environment**.
4. Run **Manual Deploy** (Deploys → Deploy latest commit) so the app uses the correct URL.

## 5. Using the Blueprint (render.yaml) Instead

The repo includes a `render.yaml` Blueprint. It does **not** create a Render Postgres database; you use Supabase only.

1. **New +** → **Blueprint**.
2. Connect the same repository.
3. Render creates one web service. In the service **Environment** tab, set `NEXT_PRIVATE_DATABASE_URL` and `NEXT_PRIVATE_DIRECT_DATABASE_URL` to your Supabase URLs.
4. Set the three URL vars to `https://sign.pinogy.com` and add the rest of the required env vars as in step 2.
5. Add the custom domain `sign.pinogy.com` under Settings → Custom Domains.

## Troubleshooting

- **Build fails**: Ensure **Build Command** is exactly `npm ci && npm run build` and **Root Directory** is empty.
- **Migrations fail**: Check that `NEXT_PRIVATE_DIRECT_DATABASE_URL` is the Supabase **direct** URL (port 5432) and that the password is URL-encoded (e.g. `$` → `%24`).
- **502 / app not starting**: Check the **Logs** tab for errors. Confirm all required env vars are set, especially `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and both database URLs.
- **Free instance sleeps**: On the free plan, the service sleeps after inactivity. The first request after sleep can take 30–60 seconds to respond.
