import toast from "react-hot-toast";

export const deleteField = async (field: any) => {
  if (!field.id) {
    return;
  }

  try {
    const deleted = toast.promise(
      fetch(`/api/documents/${field.documentId}/fields/${field.id}`, {
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
    return deleted;
  } catch (error) {}
};
