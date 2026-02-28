import { Trans } from '@lingui/react/macro';

import { Spinner } from '@documenso/ui/primitives/spinner';

type EnvelopePageImageProps = {
  renderStatus: 'loading' | 'loaded' | 'error';
  imageProps: React.ImgHTMLAttributes<HTMLImageElement> & Record<string, unknown> & { alt: '' };
};

export const EnvelopePageImage = ({ renderStatus, imageProps }: EnvelopePageImageProps) => {
  return (
    <>
      {/* Loading State */}
      {renderStatus === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      {renderStatus === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p>
            <Trans>Error loading page</Trans>
          </p>
        </div>
      )}

      {/* The PDF image. */}
      <img {...imageProps} alt="" />
    </>
  );
};
