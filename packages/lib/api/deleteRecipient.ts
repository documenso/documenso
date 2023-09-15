import toast from "react-hot-toast";

export const deleteRecipient = (recipient: any) => {
  if (!recipient.id) {
    return;
  }

  return toast.promise(
    fetch(`/api/documents/${recipient.documentId}/recipients/${recipient.id}`, {
      method: "DELETE"
    }),
    {
      loading: "Deleting...",
      success: "Deleted.",
      error: "Could not delete :/",
    },
    {
      id: "delete",
      style: {
        minWidth: "200px",
      },
    }
  );
};
