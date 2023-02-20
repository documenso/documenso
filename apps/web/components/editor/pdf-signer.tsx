import Logo from "../logo";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import SignatureDialog from "./signature-dialog";
import { useState } from "react";
import { Button } from "@documenso/ui";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export default function PDFSigner(props: any) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>(props.fields);
  const [dialogField, setDialogField] = useState<any>();

  function onClick(item: any) {
    if (item.type === "SIGNATURE") {
      setDialogField(item);
      setOpen(true);
    }
  }

  function onDialogClose(dialogResult: any) {
    const signature = {
      fieldId: dialogField.id,
      type: dialogResult.type,
      typedSignature: dialogResult.typedSignature,
      signatureImage: dialogResult.signatureImage,
    };

    setSignatures(signatures.concat(signature));

    fields.splice(
      fields.findIndex(function (i) {
        return i.id === signature.fieldId;
      }),
      1
    );
    const signedField = { ...dialogField };
    signedField.signature = signature;
    setFields(fields.concat(signedField));
    setOpen(false);
    setDialogField(null);
  }

  function sign() {
    const body = { documentId: props.document.id, signatures: signatures };
    toast.promise(
      fetch(
        `/api/documents/${props.document.id}/sign?token=${router.query.token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      ).then(() => {
        router.push(
          `/documents/${props.document.id}/signed?token=${router.query.token}`
        );
      }),
      {
        loading: "Signing...",
        success: `"${props.document.title}" signed successfully.`,
        error: "Could not sign :/",
      }
    );
  }

  return (
    <>
      <SignatureDialog open={open} setOpen={setOpen} onClose={onDialogClose} />
      <div className="bg-neon p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Logo className="inline w-10"></Logo>
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-lg text-slate-700">
              Timur Ercan (timur.ercan31@gmail.com) would like you to sign this
              document.
            </p>
            <Button
              disabled={signatures.length < props.fields.length}
              color="secondary"
              icon={CheckBadgeIcon}
              className="float-right"
              onClick={() => {
                sign();
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
      {/* todo use public url with token auth to get document */}
      <PDFViewer
        readonly={true}
        document={props.document}
        fields={fields}
        pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}?token=${router.query.token}`}
        onClick={onClick}
      ></PDFViewer>
    </>
  );
}
