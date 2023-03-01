export const getDocuments = (): Promise<Response> => {
  return fetch("/api/documents", {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
