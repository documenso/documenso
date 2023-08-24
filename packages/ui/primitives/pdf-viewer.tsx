'use client';

import React, { useEffect, useRef, useState } from 'react';

import { Loader } from 'lucide-react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import { cn } from '@documenso/ui/lib/utils';

export type LoadedPDFDocument = PDFDocumentProxy;

/**
 * This imports the worker from the `pdfjs-dist` package.
 */
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

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
        className={cn('w-full overflow-hidden rounded', {
          'h-[80vh] max-h-[60rem]': numPages === 0,
        })}
        onLoadSuccess={(d) => onDocumentLoaded(d)}
        externalLinkTarget="_blank"
        loading={
          <div className="dark:bg-background flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50">
            <Loader className="text-documenso h-12 w-12 animate-spin" />

            <p className="text-muted-foreground mt-4">Loading document...</p>
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
                renderAnnotationLayer={false}
                renderTextLayer={false}
                onClick={(e) => onDocumentPageClick(e, i + 1)}
              />
            </div>
          ))}
      </PDFDocument>
    </div>
  );
};

export default PDFViewer;
