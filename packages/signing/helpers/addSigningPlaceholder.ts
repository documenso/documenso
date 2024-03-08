import signer from 'node-signpdf';
import {
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
  rectangle,
} from 'pdf-lib';

export type AddSigningPlaceholderOptions = {
  pdf: Buffer;
};

export const addSigningPlaceholder = async ({ pdf }: AddSigningPlaceholderOptions) => {
  const doc = await PDFDocument.load(pdf);
  const pages = doc.getPages();

  const byteRange = PDFArray.withContext(doc.context);

  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of(signer.byteRangePlaceholder));
  byteRange.push(PDFName.of(signer.byteRangePlaceholder));
  byteRange.push(PDFName.of(signer.byteRangePlaceholder));

  const signature = doc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: byteRange,
    Contents: PDFHexString.fromText(' '.repeat(8192)),
    Reason: PDFString.of('Signed by Documenso'),
    M: PDFString.fromDate(new Date()),
  });

  const signatureRef = doc.context.register(signature);

  const widget = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: [0, 0, 0, 0],
    V: signatureRef,
    T: PDFString.of('Signature1'),
    F: 4,
    P: pages[0].ref,
  });

  const xobj = widget.context.formXObject([rectangle(0, 0, 0, 0)]);

  const streamRef = widget.context.register(xobj);

  widget.set(PDFName.of('AP'), widget.context.obj({ N: streamRef }));

  const widgetRef = doc.context.register(widget);

  let widgets = pages[0].node.get(PDFName.of('Annots'));

  if (widgets instanceof PDFArray) {
    widgets.push(widgetRef);
  } else {
    const newWidgets = PDFArray.withContext(doc.context);

    newWidgets.push(widgetRef);

    pages[0].node.set(PDFName.of('Annots'), newWidgets);

    widgets = pages[0].node.get(PDFName.of('Annots'));
  }

  if (!widgets) {
    throw new Error('No widgets');
  }

  pages[0].node.set(PDFName.of('Annots'), widgets);

  doc.catalog.set(
    PDFName.of('AcroForm'),
    doc.context.obj({
      SigFlags: 3,
      Fields: [widgetRef],
    }),
  );

  return Buffer.from(await doc.save({ useObjectStreams: false }));
};
