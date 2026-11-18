import { Img } from '../components';
import { getEmailAssetUrl } from '../utils/asset-url';

export interface TemplateImageProps {
  assetBaseUrl: string;
  className?: string;
  staticAsset: string;
}

export const TemplateImage = ({ assetBaseUrl, className, staticAsset }: TemplateImageProps) => {
  return <Img className={className} src={getEmailAssetUrl(assetBaseUrl, `static/${staticAsset}`)} alt="" />;
};

export default TemplateImage;
