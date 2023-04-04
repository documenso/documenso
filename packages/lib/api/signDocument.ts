import { useRouter } from "next/router";
import toast from "react-hot-toast";

export const signDocument = (document: any, signatures: any[], token: string): Promise<any> => {
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
