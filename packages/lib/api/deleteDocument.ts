export const deleteDocument = (documentId: number): Promise<Response> => {
  return fetch(`/api/documents/${documentId}`, {
    method: "DELETE",
  });
};
