import { createField } from "@documenso/features/editor";
import {
  createOrUpdateField,
  deleteField,
  signDocument,
} from "@documenso/lib/api";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { Document, Field, FieldType, Recipient, Signature, User } from "@documenso/prisma/client";
import { Button } from "@documenso/ui";
import {
  CheckBadgeIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Logo from "../logo";
import SignatureDialog, { SignatureDialogOnCloseHandler } from "./signature-dialog";

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export interface PDFSignerProps {
  document: Document & {
    User: User,
  };
  fields: Array<Field & {
    Signature: Signature,
    // TODO: find all the code that depends on this and replace it
    // TODO: with `Signature`.
    signature: unknown,
  }>;
  recipient: Recipient;
}

export default function PDFSigner({
  document,
  fields: documentFields,
  recipient
}: PDFSignerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingDone, setSigningDone] = useState(false);
  const [localSignatures, setLocalSignatures] = useState<any[]>([]);
  const [fields, setFields] = useState(documentFields);
  
  const signatureFields = useMemo(() => fields.filter(
    (field) => field.type === FieldType.SIGNATURE
  ), [fields]);
  
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

  const onDialogClose: SignatureDialogOnCloseHandler = (dialogResult) => {
    // TODO: handle signature removed from field, remove free field if dialogresult is empty (or the id )
    // This looks like it's never used any more as the SignatureDialog doesn't emit an event matching this signature
    if (!dialogResult && dialogField.type === "FREE_SIGNATURE") {
      onDeleteHandler(dialogField.id);
      return;
    }

    if (!dialogResult) return;

    const signature = {
      fieldId: dialogField.id,
      type: dialogResult.type,
      typedSignature: 'typedSignature' in dialogResult ? dialogResult.typedSignature : undefined,
      signatureImage: 'signatureImage' in dialogResult ? dialogResult.signatureImage : undefined,
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
    setFields((prevState) => [...prevState, signedField]);
    setOpen(false);
    setDialogField(null);
  }

  return (
    <>
      <SignatureDialog open={open} setOpen={setOpen} onClose={onDialogClose} />

      <div className="bg-neon p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Logo className="-mt-2.5 h-12 w-12"></Logo>
          </div>
          <div className="ml-3 flex-1 items-center justify-start text-center md:flex md:justify-between">
            <p className="text-lg text-slate-700">
              {document.User.name
                ? `${document.User.name} (${document.User.email})`
                : document.User.email}{" "}
              would like you to sign this document.
            </p>

            <p className="mt-3 text-sm md:mt-0 md:ml-6">
              <Button
                disabled={!signingDone}
                color="secondary"
                icon={CheckBadgeIcon}
                className="float-right"
                onClick={() => {
                  signDocument(
                    document,
                    localSignatures,
                    `${router.query.token}`
                  ).then(() => {
                    router.push(
                      `/documents/${document.id}/signed?token=${router.query.token}`
                    );
                  });
                }}
              >
                Done
              </Button>
            </p>
          </div>
        </div>
      </div>

      {signatureFields.length === 0 ? (
        <div className="bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3 flex-1 md:flex md:justify-between">
              <p className="text-sm text-yellow-700">
                You can sign this document anywhere you like, but maybe look for a signature line.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <PDFViewer
        style={{
          cursor:
            signatureFields.length === 0
              ? `url("https://place-hold.it/110x64/37f095/ffffff&text=Signature") 55 32, auto`
              : "",
        }}
        readonly={true}
        document={document}
        fields={fields}
        pdfUrl={`${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${router.query.id}?token=${router.query.token}`}
        onClick={onClick}
        onMouseDown={function onMouseDown(e: any, page: number) {
          if (signatureFields.length === 0)
            addFreeSignature(e, page, recipient);
        }}
        onMouseUp={() => {}}
        onDelete={onDeleteHandler}></PDFViewer>
    </>
  );

  function checkIfSigningIsDone(): boolean {
    // Check if all fields are signed..
    if (signatureFields.length > 0) {
      // If there are no fields to sign at least one signature is enough
      return fields
        .filter((field) => field.type === FieldType.SIGNATURE)
        .every((field) => field.signature);
    } else {
      return localSignatures.length > 0;
    }
  }

  function addFreeSignature(e: any, page: number, recipient: any): any {
    const freeSignatureField = createField(e, page, recipient, FieldType.FREE_SIGNATURE);

    createOrUpdateField(
      document,
      freeSignatureField,
      recipient.token
    ).then((res) => {
      setFields((prevState) => [...prevState, res]);
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
      deleteField(field).catch((_err) => {
        setFields(fieldWithoutRemoved.concat(removedField));
        setLocalSignatures(signaturesWithoutRemoved.concat(removedSignature));
      });
    }
  }
}
