import { Field, Document as PrismaDocument } from "@prisma/client";
import toast from "react-hot-toast";

export const createOrUpdateField = async (
  document: PrismaDocument,
  field: Field,
  recipientToken: string = ""
): Promise<Response> => {
  try {
    const created = await toast.promise(
      fetch("/api/documents/" + document.id + "/fields?token=" + recipientToken, {
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
        loading: field?.id !== -1 ? "Saving..." : "Adding...",
        success: field?.id !== -1 ? "Saved." : "Added.",
        error: field?.id !== -1 ? "Could not save :/" : "Could not add :/",
      },
      {
        id: "saving field",
        style: {
          minWidth: "200px",
        },
      }
    );
    return created;
  } catch (error) {
    throw error;
  }
};
