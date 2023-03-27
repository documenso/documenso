import router from "next/router";
import toast from "react-hot-toast";
import { NEXT_PUBLIC_WEBAPP_URL } from "../lib/constants";

export const uploadDocument = async (event: any) => {
  if (event.target.files && event.target.files[0]) {
    const body = new FormData();
    const document = event.target.files[0];
    const fileName: string = event.target.files[0].name;

    if (!fileName.endsWith(".pdf")) {
      toast.error("Non-PDF documents are not supported yet.");
      return;
    }
    body.append("document", document || "");
    const response: any = await toast
      .promise(
        fetch("/api/documents", {
          method: "POST",
          body,
        }),
        {
          loading: "Uploading document...",
          success: `${fileName} uploaded successfully.`,
          error: "Could not upload document :/",
        }
      )
      .then((response: Response) => {
        response.json().then((createdDocumentIdFromBody) => {
          router.push(
            `${NEXT_PUBLIC_WEBAPP_URL}/documents/${createdDocumentIdFromBody}/recipients`
          );
        });
      });
  }
};
