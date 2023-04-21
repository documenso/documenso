export const NEXT_PUBLIC_WEBAPP_URL =
  process.env.IS_PULL_REQUEST === "true"
    ? process.env.RENDER_EXTERNAL_URL
    : process.env.NEXT_PUBLIC_WEBAPP_URL;

console.log("IS_PULL_REQUEST:" + process.env.IS_PULL_REQUEST);
console.log("RENDER_EXTERNAL_URL:" + process.env.RENDER_EXTERNAL_URL);
console.log("NEXT_PUBLIC_WEBAPP_URL:" + process.env.NEXT_PUBLIC_WEBAPP_URL);
