export const signup = (source: any, data: any) => {
  return fetch("/api/auth/signup", {
    body: JSON.stringify({
      source: source,
      ...data,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
};
