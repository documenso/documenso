import { Document as PrismaDocument, Signature } from "@prisma/client";
import toast from "react-hot-toast";

export const signDocument = (
  document: PrismaDocument,
  signatures: Signature[],
  token: string
): Promise<Response> => {
  const body = { documentId: document.id, signatures };

  return toast.promise(
    fetch(`/api/documents/${document.id}/sign?token=${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    {
      loading: "Signing...",
      success: `"${document.title}" signed successfully.`,
      error: "Could not sign :/",
    }
  );
};
