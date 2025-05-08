import csvParser from 'csv-parser';
import PdfParser from 'pdf2json';
import { Readable } from 'stream';
import * as xlsx from 'xlsx';
import * as xml2js from 'xml2js';

// Función para detectar si un PDF es escaneado (sin texto extraíble)
const isScannedPDF = async (buffer: Buffer): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const pdfParser = new PdfParser();

    pdfParser.on('pdfParser_dataError', (err) => reject(err));
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      let hasText = false;
      pdfData.Pages.forEach((page) => {
        if (page.Texts.length > 0) {
          hasText = true;
        }
      });
      resolve(!hasText); // Si no tiene texto, es un PDF escaneado
    });

    pdfParser.parseBuffer(buffer);
  });
};

// Función para extraer texto desde un PDF en AWS Textract usando la API FastAPI
const extractTextFromScannedPDF = async (fileUrl: string): Promise<string> => {
  try {
    const response = await fetch('https://aws-textract.onrender.com/extract-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // 🔹 Asegura que FastAPI reciba JSON correctamente
      },
      body: JSON.stringify({ url: fileUrl }),
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const json = await response.json();
    console.log('✅ Respuesta de la API:', json);

    return json.extracted_text || 'No se extrajo texto.'; // 🔹 Asegura que siempre retorne un string
  } catch (error) {
    console.error('❌ Error al obtener datos:', error);
    return 'Error al procesar el PDF.'; // 🔹 Devuelve un string en caso de error
  }
};

// Función para extraer texto desde un archivo PDF normal (con texto embebido)
const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const pdfParser = new PdfParser();

    pdfParser.on('pdfParser_dataError', (err) => reject(err));
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      let text = '';
      pdfData.Pages.forEach((page) => {
        page.Texts.forEach((textObj) => {
          text += decodeURIComponent(textObj.R[0].T) + ' ';
        });
      });
      resolve(text.trim());
    });

    pdfParser.parseBuffer(buffer);
  });
};

// const extractTextFromPDF = (buffer: Buffer): Promise<string> => {
//   return new Promise<string>((resolve, reject) => {
//     const pdfParser = new PdfParser();

//     pdfParser.on("pdfParser_dataError", (err) => reject(err));
//     pdfParser.on("pdfParser_dataReady", (pdfData) => {
//       resolve(JSON.stringify(pdfData, null, 2));
//     });

//     pdfParser.parseBuffer(buffer);
//   });
// };

// Función para extraer texto desde un archivo CSV
const extractTextFromCSV = async (buffer: Buffer): Promise<string> => {
  return new Promise((resolve) => {
    const results: string[] = [];
    Readable.from(buffer.toString())
      .pipe(csvParser())
      .on('data', (row) => results.push(JSON.stringify(row)))
      .on('end', () => resolve(results.join('\n')));
  });
};

// Función para extraer texto desde un archivo Excel (XLSX)
const extractTextFromExcel = (buffer: Buffer): string => {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0]; // Obtiene la primera hoja del archivo
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_csv(sheet);
};

// Función para extraer texto desde un archivo XML
const extractTextFromXML = async (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    xml2js.parseString(buffer.toString(), (err, result) => {
      if (err) reject(err);
      resolve(JSON.stringify(result, null, 2));
    });
  });
};

// Función para determinar el tipo de archivo y extraer su contenido en texto
export const extractText = async (
  fileKey: string,
  buffer: Buffer | null,
  fileUrl?: string,
): Promise<string | null> => {
  const extension = fileKey.split('.').pop()?.toLowerCase();
  console.log('Extensión del archivo:', extension); // Depuración

  try {
    switch (extension) {
      case 'pdf': {
        if (!buffer) {
          if (!fileUrl) return 'Error: Se necesita un buffer o una URL.';
          return await extractTextFromScannedPDF(fileUrl);
        }

        const scanned = await isScannedPDF(buffer);
        if (scanned) {
          if (!fileUrl) return 'Error: Se necesita una URL para procesar el PDF escaneado.';
          return await extractTextFromScannedPDF(fileUrl);
        } else {
          return await extractTextFromPDF(buffer);
        }
      }
      case 'csv':
        if (!buffer) return 'Error: Se necesita un buffer para procesar el CSV.';
        return await extractTextFromCSV(buffer);

      case 'xls':
      case 'xlsx':
        if (!buffer) return 'Error: Se necesita un buffer para procesar el Excel.';
        return extractTextFromExcel(buffer);

      case 'xml':
        if (!buffer) return 'Error: Se necesita un buffer para procesar el XML.';
        return await extractTextFromXML(buffer);

      default:
        return 'Formato no soportado.';
    }
  } catch (error) {
    console.error('Error al extraer texto:', error);
    return null;
  }
};
