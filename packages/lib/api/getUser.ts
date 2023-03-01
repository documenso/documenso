export const getUser = (): Promise<any> => {
  return fetch("/api/users/me");
};
