import { PortalSessionRequest, PortalSessionResponse } from "../handlers/portal-session";

export type FetchPortalSessionOptions = PortalSessionRequest["body"];

export const fetchPortalSession = async ({ id }: FetchPortalSessionOptions) => {
  const response = await fetch("/api/stripe/portal-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id,
    }),
  });

  const json: PortalSessionResponse = await response.json();

  return json;
};
