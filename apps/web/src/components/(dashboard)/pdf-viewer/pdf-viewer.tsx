'use client';

import { useEffect, useRef, useState } from 'react';

import { Loader } from 'lucide-react';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import { cn } from '@documenso/ui/lib/utils';

type LoadedPDFDocument = pdfjs.PDFDocumentProxy;

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

export type PDFViewerProps = {
  className?: string;
  document: string;
  [key: string]: unknown;
};

export const PDFViewer = ({ className, document, ...props }: PDFViewerProps) => {
  const $el = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);

  const onDocumentLoaded = (doc: LoadedPDFDocument) => {
    setNumPages(doc.numPages);
  };

  useEffect(() => {
    if ($el.current) {
      const $current = $el.current;

      const { width } = $current.getBoundingClientRect();

      setWidth(width);

      const onResize = () => {
        const { width } = $current.getBoundingClientRect();

        setWidth(width);
      };

      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('resize', onResize);
      };
    }
  }, []);

  return (
    <div ref={$el} className={cn('overflow-hidden', className)}>
      <PDFDocument
        file={`data:application/pdf;base64,${document}`}
        className="w-full overflow-hidden rounded"
        onLoadSuccess={(d) => onDocumentLoaded(d)}
        externalLinkTarget="_blank"
        loading={
          <div className="flex min-h-[80vh] flex-col items-center justify-center bg-white/50">
            <Loader className="h-12 w-12 animate-spin text-slate-500" />

            <p className="mt-4 text-slate-500">Loading document...</p>
          </div>
        }
      >
        {Array(numPages)
          .fill(null)
          .map((_, i) => (
            <div
              key={i}
              className="border-t-primary mt-8 border-t pt-8 first:mt-0 first:border-t-0 first:pt-0"
            >
              <PDFPage pageNumber={i + 1} width={width} />
            </div>
          ))}
      </PDFDocument>
    </div>
  );
};

export default PDFViewer;
