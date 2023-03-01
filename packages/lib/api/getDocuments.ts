export const getDocuments = (): any => {
  return fetch("/api/documents", {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
