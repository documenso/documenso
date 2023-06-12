'use client';

import React, { useEffect, useRef, useState } from 'react';

import { Loader } from 'lucide-react';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import { cn } from '@documenso/ui/lib/utils';

type LoadedPDFDocument = pdfjs.PDFDocumentProxy;

/**
 * This imports the worker from the `pdfjs-dist` package.
 */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

export type OnPDFViewerPageClick = (_event: {
  pageNumber: number;
  numPages: number;
  originalEvent: React.MouseEvent<HTMLDivElement, MouseEvent>;
  pageHeight: number;
  pageWidth: number;
  pageX: number;
  pageY: number;
}) => void | Promise<void>;

export type PDFViewerProps = {
  className?: string;
  document: string;
  onPageClick?: OnPDFViewerPageClick;
  [key: string]: unknown;
};

export const PDFViewer = ({ className, document, onPageClick, ...props }: PDFViewerProps) => {
  const $el = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);

  const onDocumentLoaded = (doc: LoadedPDFDocument) => {
    setNumPages(doc.numPages);
  };

  const onDocumentPageClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    pageNumber: number,
  ) => {
    const $el = event.target instanceof HTMLElement ? event.target : null;

    if (!$el) {
      return;
    }

    const $page = $el.closest('.react-pdf__Page');

    if (!$page) {
      return;
    }

    const { height, width, top, left } = $page.getBoundingClientRect();

    const pageX = event.clientX - left;
    const pageY = event.clientY - top;

    console.log({
      pageNumber,
      numPages,
      originalEvent: event,
      pageHeight: height,
      pageWidth: width,
      pageX,
      pageY,
    });

    if (onPageClick) {
      onPageClick({
        pageNumber,
        numPages,
        originalEvent: event,
        pageHeight: height,
        pageWidth: width,
        pageX,
        pageY,
      });
    }
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
    <div ref={$el} className={cn('overflow-hidden', className)} {...props}>
      <PDFDocument
        file={document}
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
              className="border-border my-8 overflow-hidden rounded border first:mt-0 last:mb-0"
            >
              <PDFPage
                pageNumber={i + 1}
                width={width}
                onClick={(e) => onDocumentPageClick(e, i + 1)}
              />
            </div>
          ))}
      </PDFDocument>
    </div>
  );
};

export default PDFViewer;
