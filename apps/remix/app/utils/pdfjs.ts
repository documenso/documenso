import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export { pdfjsLib };
