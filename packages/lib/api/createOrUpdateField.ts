import toast from "react-hot-toast";

export const createOrUpdateField = async (
  document: any,
  field: any
): Promise<any> => {
  try {
    const created = await toast.promise(
      fetch("/api/documents/" + document.id + "/fields", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(field),
      }).then((res) => {
        if (!res.ok) {
          throw new Error(res.status.toString());
        }
        return res.json();
      }),
      {
        loading: "Adding...",
        success: "Added.",
        error: "Could not add :/",
      },
      {
        id: "saving field",
        style: {
          minWidth: "200px",
        },
      }
    );
    return created;
  } catch (error) {}
};
