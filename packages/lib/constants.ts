export const NEXT_PUBLIC_WEBAPP_URL =
  process.env.IS_PULL_REQUEST === "true"
    ? process.env.RENDER_EXTERNAL_URL
    : process.env.NEXT_PUBLIC_WEBAPP_URL;