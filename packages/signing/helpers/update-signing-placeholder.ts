export type UpdateSigningPlaceholderOptions = {
  pdf: Buffer;
};

export const updateSigningPlaceholder = ({ pdf }: UpdateSigningPlaceholderOptions) => {
  const length = pdf.length;

  const byteRangePos = pdf.lastIndexOf('/ByteRange');
  const byteRangeStart = pdf.indexOf('[', byteRangePos);
  const byteRangeEnd = pdf.indexOf(']', byteRangePos);

  const byteRangeSlice = pdf.subarray(byteRangeStart, byteRangeEnd + 1);

  const signaturePos = pdf.indexOf('/Contents', byteRangeEnd);
  const signatureStart = pdf.indexOf('<', signaturePos);
  const signatureEnd = pdf.indexOf('>', signaturePos);

  const signatureSlice = pdf.subarray(signatureStart, signatureEnd + 1);

  const byteRange = [0, 0, 0, 0];

  byteRange[1] = signatureStart;
  byteRange[2] = byteRange[1] + signatureSlice.length;
  byteRange[3] = length - byteRange[2];

  const newByteRange = `[${byteRange.join(' ')}]`.padEnd(byteRangeSlice.length, ' ');

  const updatedPdf = Buffer.concat([
    new Uint8Array(pdf.subarray(0, byteRangeStart)),
    new Uint8Array(Buffer.from(newByteRange)),
    new Uint8Array(pdf.subarray(byteRangeEnd + 1)),
  ]);

  if (updatedPdf.length !== length) {
    throw new Error('Updated PDF length does not match original length');
  }

  return { pdf: updatedPdf, byteRange };
};
