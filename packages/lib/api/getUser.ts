export const getUser = (): Promise<Response> => {
  return fetch("/api/users/me");
};
