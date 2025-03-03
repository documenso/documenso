import type { NextApiRequest, NextApiResponse } from 'next';

import { createDocument, generatePdf } from '@documenso/lib/server-only/madverse';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

const getFieldTypeFromMarker = (marker: string) => {
  switch (marker) {
    case 'NAME':
      return 'NAME';
    case 'DATE':
      return 'DATE';
    case 'SIGNATURE':
      return 'SIGNATURE';
    default:
      return 'SIGNATURE';
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { labelName, labelAddress, labelEmail } = req.body;
    const pdfFile = await generatePdf({ labelName, labelAddress });

    if (!pdfFile.success || !pdfFile.file) {
      return res.status(500).json({ error: 'Failed to generate PDF' });
    }

    const recipients = [
      {
        name: 'Rohan Nesho Jain',
        email: 'madverse@madverse.co',
        role: 'SIGNER' as const,
        signingOrder: 1,
      },
      {
        name: labelName,
        email: labelEmail,
        role: 'SIGNER' as const,
        signingOrder: 2,
      },
    ];
    const doc = await createDocument({
      title: `${labelName} - Executive Plan Agreement`,
      recipients,
    });

    const { data } = doc;
    const { uploadUrl, documentId, recipients: recipientData } = data;

    // First upload the PDF file
    const formData = new FormData();
    formData.append('file', pdfFile.file);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      return res.status(500).json({ error: 'Failed to upload PDF' });
    }

    const userCoordinates = pdfFile.signatureBoxCoordinates;
    const madverseCoordinates = pdfFile.madverseSignatureBoxCoordinates;

    const coordinates = userCoordinates.map((coord) => ({
      recipientId: Number(recipientData[1].recipientId),
      type: getFieldTypeFromMarker(coord.marker),
      pageNumber: coord.pageNumber || 1,
      pageX: coord.x,
      pageY: coord.y,
      pageWidth: coord.width,
      pageHeight: coord.height || 50,
    }));

    coordinates.push({
      recipientId: Number(recipientData[0].recipientId),
      type: getFieldTypeFromMarker(madverseCoordinates.marker),
      pageNumber: madverseCoordinates.pageNumber || 1,
      pageX: madverseCoordinates.x,
      pageY: madverseCoordinates.y,
      pageWidth: madverseCoordinates.width,
      pageHeight: madverseCoordinates.height || 50,
    });

    // Add signature fields to the document
    const addFieldsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/v1/documents/${documentId}/fields`,
      {
        method: 'POST',
        headers: {
          Authorization: `${process.env.ADMIN_ACCOUNT_API_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(coordinates),
      },
    );

    if (!addFieldsResponse.ok) {
      const errorData = await addFieldsResponse.json();
      console.error('Failed to add fields:', {
        status: addFieldsResponse.status,
        statusText: addFieldsResponse.statusText,
        error: errorData,
      });
      return res.status(500).json({ error: 'Failed to add signature fields', details: errorData });
    }

    // change document status to pending by default (we will send the email from admin dashboard)
    await prisma.document.update({
      where: {
        id: documentId,
      },
      data: {
        status: DocumentStatus.PENDING,
      },
    });

    return res.status(200).json({
      success: true,
      signingUrl: recipientData[1].signingUrl,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
