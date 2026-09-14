import type { ImageLoadingState } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { cn } from '@documenso/ui/lib/utils';
import { Spinner } from '@documenso/ui/primitives/spinner';
import { Trans } from '@lingui/react/macro';

type PdfViewerPageImageProps = {
  imageLoadingState: ImageLoadingState;

  /**
   * Whether the page and everything drawn on it are ready to be shown.
   */
  isPageReady: boolean;

  imageProps: React.ImgHTMLAttributes<HTMLImageElement> & Record<string, unknown> & { alt: '' };
};

export const PdfViewerPageImage = ({ imageLoadingState, isPageReady, imageProps }: PdfViewerPageImageProps) => {
  const isLoading = !isPageReady && imageLoadingState !== 'error';

  return (
    <>
      {/* Loading State */}
      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center text-muted-foreground opacity-20"
          data-testid="page-loader"
        >
          <Spinner />
        </div>
      )}

      {imageLoadingState === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p>
            <Trans>Error loading page</Trans>
          </p>
        </div>
      )}

      {/* The PDF image.
          Kept mounted while the page is not ready, since it is the image
          loading which reports the page as loaded, but hidden so the page is
          only revealed once everything drawn on it is ready too. */}
      {imageProps.src && (
        <img
          {...imageProps}
          className={cn(imageProps.className, 'select-none', !isPageReady && 'invisible')}
          draggable={false}
          alt=""
        />
      )}
    </>
  );
};
