import toast from "react-hot-toast";

export const deleteField = async (field: any) => {
  if (!field.id) {
    return;
  }

  try {
    const deleted = toast.promise(
      fetch("/api/documents/" + 0 + "/fields/" + field.id, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(field),
      }).then((res) => {
        if (!res.ok) {
          throw new Error(res.status.toString());
        }
        return res;
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
