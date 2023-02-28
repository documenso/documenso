import Logo from "../logo";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import SignatureDialog from "./signature-dialog";
import { useEffect, useState } from "react";
import { Button } from "@documenso/ui";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { FieldType } from "@prisma/client";
import {
  createOrUpdateField,
  deleteField,
  signDocument,
} from "@documenso/lib/api";
import { createField } from "@documenso/features/editor";

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export default function PDFSigner(props: any) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingDone, setSigningDone] = useState(false);
  const [localSignatures, setLocalSignatures] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>(props.fields);
  const [dialogField, setDialogField] = useState<any>();

  useEffect(() => {
    setSigningDone(checkIfSigningIsDone());
  }, [fields]);

  function onClick(item: any) {
    if (item.type === "SIGNATURE") {
      setDialogField(item);
      setOpen(true);
    }
  }

  function onDialogClose(dialogResult: any) {
    // todo handle signature removed from field
    // todo remove free field if dialogresult is empty (or the id )
    if (!dialogResult && dialogField.type === "FREE_SIGNATURE") {
      onDeleteHandler(dialogField.id);
      return;
    }

    const signature = {
      fieldId: dialogField.id,
      type: dialogResult.type,
      typedSignature: dialogResult.typedSignature,
      signatureImage: dialogResult.signatureImage,
    };

    setLocalSignatures(localSignatures.concat(signature));

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
              disabled={!signingDone}
              color="secondary"
              icon={CheckBadgeIcon}
              className="float-right"
              onClick={() => {
                signDocument(
                  props.document,
                  localSignatures,
                  `${router.query.token}`
                ).then(() => {
                  router.push(
                    `/documents/${props.document.id}/signed?token=${router.query.token}`
                  );
                });
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
        onMouseDown={function onMouseDown(e: any, page: number) {
          if (
            fields.filter((field) => field.type === FieldType.SIGNATURE)
              .length === 0
          )
            addFreeSignature(e, page, props.recipient);
        }}
        onMouseUp={() => {}}
        onDelete={onDeleteHandler}
      ></PDFViewer>
    </>
  );

  function checkIfSigningIsDone(): boolean {
    // Check if all fields are signed..
    if (fields.length > 0) {
      // If there are no fields to sign at least one signature is enough
      return fields.every((field) => field.signature);
    } else {
      return localSignatures.length > 0;
    }
  }

  function addFreeSignature(
    e: any,
    page: number,
    recipient: any
  ): any {
    const freeSignatureField = createField(
      e,
      page,
      recipient,
      FieldType.FREE_SIGNATURE
    );

    createOrUpdateField(props.document, freeSignatureField).then((res) => {
      setFields(fields.concat(res));
      setDialogField(res);
      setOpen(true);
    });

    return freeSignatureField;
  }

  function onDeleteHandler(id: any) {
    const field = fields.find((e) => e.id == id);
    const fieldIndex = fields.map((item) => item.id).indexOf(id);
    if (fieldIndex > -1) {
      const fieldWithoutRemoved = [...fields];
      const removedField = fieldWithoutRemoved.splice(fieldIndex, 1);
      setFields(fieldWithoutRemoved);

      const signaturesWithoutRemoved = [...localSignatures];
      const removedSignature = signaturesWithoutRemoved.splice(
        signaturesWithoutRemoved.findIndex(function (i) {
          return i.fieldId === id;
        }),
        1
      );

      setLocalSignatures(signaturesWithoutRemoved);
      deleteField(field).catch((err) => {
        setFields(fieldWithoutRemoved.concat(removedField));
        setLocalSignatures(signaturesWithoutRemoved.concat(removedSignature));
      });
    }
  }
}
