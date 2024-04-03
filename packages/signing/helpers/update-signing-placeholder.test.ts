import { describe, expect, it } from 'vitest';

import { updateSigningPlaceholder } from './update-signing-placeholder';

describe('updateSigningPlaceholder', () => {
  const pdf = Buffer.from(`
      20 0 obj
      <<
      /Type /Sig
      /Filter /Adobe.PPKLite
      /SubFilter /adbe.pkcs7.detached
      /ByteRange [ 0 /********** /********** /********** ]
      /Contents <0000000000000000000000000000000000000000000000000000000>
      /Reason (Signed by Documenso)
      /M (D:20210101000000Z)
      >>
      endobj
    `);

  it('should not throw an error', () => {
      expect(() => updateSigningPlaceholder({ pdf })).not.toThrowError();
  });

  it('should not modify the original PDF', () => {
    const result = updateSigningPlaceholder({ pdf });

    expect(result.pdf).not.toEqual(pdf);
  });

  it('should return a PDF with the same length as the original', () => {
    const result = updateSigningPlaceholder({ pdf });

    expect(result.pdf).toHaveLength(pdf.length);
  });

  it('should update the byte range and return it', () => {
    const result = updateSigningPlaceholder({ pdf });

    expect(result.byteRange).toEqual([0, 184, 241, 92]);
  });

  it('should only update the last signature in the PDF', () => {
    const pdf = Buffer.from(`
      20 0 obj
      <<
      /Type /Sig
      /Filter /Adobe.PPKLite
      /SubFilter /adbe.pkcs7.detached
      /ByteRange [ 0 /********** /********** /********** ]
      /Contents <0000000000000000000000000000000000000000000000000000000>
      /Reason (Signed by Documenso)
      /M (D:20210101000000Z)
      >>
      endobj
      21 0 obj
      <<
      /Type /Sig
      /Filter /Adobe.PPKLite
      /SubFilter /adbe.pkcs7.detached
      /ByteRange [ 0 /********** /********** /********** ]
      /Contents <0000000000000000000000000000000000000000000000000000000>
      /Reason (Signed by Documenso)
      /M (D:20210101000000Z)
      >>
      endobj
    `);

    const result = updateSigningPlaceholder({ pdf });

    expect(result.byteRange).toEqual([0, 512, 569, 92]);
  });
});
