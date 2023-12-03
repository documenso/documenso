import ConvertApi from 'convertapi-js';

async function convertDocumentToPDF(file: File): Promise<File> {
  try {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Configure ConvertAPI with your secret
      const convertApi = ConvertApi.auth('YOUR CONVERT API KEY');

      // Use ConvertAPI to convert the DOCX buffer to a PDF Buffer
      const params = convertApi.createParams();
      params.add('File', new File([buffer], file.name));
      params.add('Converter', 'OpenOffice');
      const result = await convertApi.convert('doc', 'pdf', params);

      // Get result file URL
      const url = result.files[0].Url;

      // Use fetch API to download the file
      const response = await fetch(url);
      const data = await response.arrayBuffer();
      const pdfBuffer = new Uint8Array(data);

      // Create and return a File object from the Buffer
      const pdfFile = new File([pdfBuffer], `${file.name.replace(/\.[^/.]+$/, '')}.pdf`, {
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
