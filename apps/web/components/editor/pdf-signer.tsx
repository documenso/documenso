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

const PDFViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
});

export default function PDFSigner(props: any) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingDone, setSigningDone] = useState(false);
  const [signatures, setSignatures] = useState<any[]>([]);
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
      {JSON.stringify(signatures)}
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
        onMouseDown={function onMouseDown(e: any, page: number) {
          if (
            fields.filter((field) => field.type === FieldType.SIGNATURE)
              .length === 0
          )
            createFieldForFreeSignature(e, page, props.recipient);
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
      return signatures.length > 0;
    }
  }

  function createFieldForFreeSignature(
    e: any,
    page: number,
    recipient: any
  ): any {
    var rect = e.target.getBoundingClientRect();
    var newFieldX = e.clientX - rect.left; //x position within the element.
    var newFieldY = e.clientY - rect.top; //y position within the element.
    const signatureField = {
      id: -1,
      page: page,
      type: FieldType.FREE_SIGNATURE,
      positionX: newFieldX.toFixed(0),
      positionY: newFieldY.toFixed(0),
      Recipient: recipient,
    };

    upsertField(props.document, signatureField).then((res) => {
      setFields(fields.concat(res));
      setDialogField(res);
      setOpen(true);
    });

    return signatureField;
  }

  function onDeleteHandler(id: any) {
    const field = fields.find((e) => e.id == id);
    const fieldIndex = fields.map((item) => item.id).indexOf(id);
    if (fieldIndex > -1) {
      const fieldWithoutRemoved = [...fields];
      const removedField = fieldWithoutRemoved.splice(fieldIndex, 1);
      setFields(fieldWithoutRemoved);

      const signaturesWithoutRemoved = [...signatures];
      const removedSignature = signaturesWithoutRemoved.splice(
        signaturesWithoutRemoved.findIndex(function (i) {
          return i.fieldId === id;
        }),
        1
      );

      setSignatures(signaturesWithoutRemoved);
      deleteField(field).catch((err) => {
        setFields(fieldWithoutRemoved.concat(removedField));
        setSignatures(signaturesWithoutRemoved.concat(removedSignature));
      });
    }
  }

  async function deleteField(field: any) {
    if (!field.id) {
      return;
    }

    try {
      const deleted = toast.promise(
        fetch("/api/documents/" + 0 + "/fields/" + field.id, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(field),
        }).then((res) => {
          if (!res.ok) {
            throw new Error(res.status.toString());
          }
          return res;
        }),
        {
          loading: "Deleting...",
          success: "Deleted.",
          error: "Could not delete :/",
        },
        {
          id: "delete",
          style: {
            minWidth: "200px",
          },
        }
      );
      return deleted;
    } catch (error) {}
  }

  async function upsertField(document: any, field: any): Promise<any> {
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
          loading: "Saving...",
          success: "Saved.",
          error: "Could not save :/",
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
  }
}
