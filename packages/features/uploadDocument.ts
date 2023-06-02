import { ChangeEvent } from "react";
import router from "next/router";
import { NEXT_PUBLIC_WEBAPP_URL } from "../lib/constants";
import toast from "react-hot-toast";

export const uploadDocument = async (event: ChangeEvent) => {
  if (event.target instanceof HTMLInputElement && event.target?.files && event.target.files[0]) {
    const body = new FormData();
    const document = event.target.files[0];
    const fileName: string = event.target.files[0].name;

    if (!fileName.endsWith(".pdf")) {
      toast.error("Non-PDF documents are not supported yet.");
      return;
    }

    body.append("document", document || "");

    await toast.promise(
      fetch("/api/documents", {
        method: "POST",
        body,
      }).then((response: Response) => {
        if (!response.ok) {
          throw new Error("Could not upload document");
        }

        response.json().then((createdDocumentIdFromBody) => {
          router.push(
            `${NEXT_PUBLIC_WEBAPP_URL}/documents/${createdDocumentIdFromBody}/recipients`
          );
        });
      }),
      {
        loading: "Uploading document...",
        success: `${fileName} uploaded successfully.`,
        error: "Could not upload document :/",
      }
    ).catch((_err) => {
      // Do nothing
    });
  }
};
