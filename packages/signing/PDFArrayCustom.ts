const { PDFArray, CharCodes, PDFContext } = require("pdf-lib");

/**
 * Extends PDFArray class in order to make ByteRange look like this:
 *  /ByteRange [0 /********** /********** /**********]
 * Not this:
 *  /ByteRange [ 0 /********** /********** /********** ]
 */


type PDFArrayCustom = typeof PDFArray & {
  clone(context: typeof PDFContext): PDFArrayCustom;
  toString(): string;
  sizeInBytes(): number;
  copyBytesInto(buffer: Uint8Array, offset: number): number;
};

const createPDFArrayCustom = (context: typeof PDFContext): PDFArrayCustom => {
  const pdfArray = new PDFArray(context);

  const clone = (ctx: typeof PDFContext = context) => {
    const clonedArray = createPDFArrayCustom(ctx);
    pdfArray.array.forEach((item: any) => clonedArray.push(item));
    return clonedArray;
  };

  const toString = () => pdfArray.array.map((item: any) => item.toString()).join(" ");

  const sizeInBytes = () => {
    let size = 2;
    pdfArray.array.forEach((item: any, idx: any) => {
      size += item.sizeInBytes();
      if (idx < pdfArray.size() - 1) size += 1;
    });
    return size;
  };

  const copyBytesInto = (buffer: Uint8Array, offset: number) => {
    const initialOffset = offset;

    buffer[offset++] = CharCodes.LeftSquareBracket;
    pdfArray.array.forEach((item: any, idx: any) => {
      offset += item.copyBytesInto(buffer, offset);
      if (idx < pdfArray.size() - 1) buffer[offset++] = CharCodes.Space;
    });
    buffer[offset++] = CharCodes.RightSquareBracket;

    return offset - initialOffset;
  };

  return {
    ...pdfArray,
    clone,
    toString,
    sizeInBytes,
    copyBytesInto,
  };
};

export default createPDFArrayCustom;
