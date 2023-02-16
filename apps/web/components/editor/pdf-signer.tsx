import Logo from "../logo";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import SignatureDialog from "./signature-dialog";
import { useState } from "react";
import { Button } from "@documenso/ui";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export default function PDFSigner(props: any) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function onClick(item: any) {
    if (item.type === "SIGNATURE") {
      setOpen(true);
    }
  }

  return (
    <>
      <SignatureDialog open={open} setOpen={setOpen}></SignatureDialog>
      <div className="bg-slate-50 shadow-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Logo className="inline w-10"></Logo>
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-lg text-slate-700">
              Timur Ercan (timur.ercan31@gmail.com) would like you to sign this
              document.
            </p>
            <Button icon={CheckBadgeIcon} className="float-right">
              Done
            </Button>
          </div>
        </div>
      </div>
      {/* todo use public url with token auth to get document */}
      <PDFViewer
        readonly={true}
        document={props.document}
        fields={props.fields}
        pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}?token=${router.query.token}`}
        onClick={onClick}
      ></PDFViewer>
    </>
  );
}
