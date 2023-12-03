import jsPDF from 'jspdf';
import mammoth from 'mammoth';

interface ConversionResult {
  value: string;
}

async function convertDocxToHtml(docxBuffer: ArrayBuffer): Promise<string> {
  const { value }: ConversionResult = await mammoth.extractRawText({ arrayBuffer: docxBuffer });
  return value;
}

async function createPDFFromHtml(htmlContent: string): Promise<Blob> {
  return new Promise((resolve) => {
    const pdf = new jsPDF();

    // Use jsPDF's html method to add HTML content to the PDF
    void pdf.html(htmlContent, {
      callback: (pdf) => {
        // Output the PDF as a blob
        const pdfBlob = pdf.output('blob');
        resolve(pdfBlob);
      },
    });
  });
}

async function convertDocumentToPDF(file: File): Promise<File> {
  try {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer();
      const htmlContent = await convertDocxToHtml(arrayBuffer);

      // Use createPDFFromHtml to convert the HTML content to a PDF Blob
      const pdfBlob = await createPDFFromHtml(htmlContent);

      // Create and return a File object from the Blob
      const pdfFile = new File([pdfBlob], `${file.name.replace(/\.[^/.]+$/, '')}.pdf`, {
        type: 'application/pdf',
      });

      return pdfFile;
    } else {
      // Return the original file if it's not a DOCX file
      return file;
    }
  } catch (error) {
    console.error('Error converting document:', error);
    throw error;
  }
}

export { convertDocumentToPDF };
