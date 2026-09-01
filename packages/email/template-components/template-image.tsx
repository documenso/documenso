import { Img } from '../components';

export interface TemplateImageProps {
  assetBaseUrl: string;
  className?: string;
  staticAsset: string;
}

export const TemplateImage = ({ assetBaseUrl, className, staticAsset }: TemplateImageProps) => {
  const getAssetUrl = (path: string) => {
    // Resolve against a trailing-slash base so a sub-path (e.g. "/ESign") in assetBaseUrl is preserved.
    const base = assetBaseUrl.endsWith('/') ? assetBaseUrl : `${assetBaseUrl}/`;
    return new URL(path.replace(/^\//, ''), base).toString();
  };

  return <Img className={className} src={getAssetUrl(`/static/${staticAsset}`)} alt="" />;
};

export default TemplateImage;
