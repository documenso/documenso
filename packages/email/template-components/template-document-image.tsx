import { Column, Img, Row, Section } from '@react-email/components';

export interface TemplateDocumentImageProps {
  assetBaseUrl: string;
  className?: string;
}

export const TemplateDocumentImage = ({ assetBaseUrl, className }: TemplateDocumentImageProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Section className={className}>
      <Row className="table-fixed">
        <Column />

        <Column>
          <Img className="h-42 mx-auto" src={getAssetUrl('/static/document.png')} alt="Documenso" />
        </Column>

        <Column />
      </Row>
    </Section>
  );
};

export default TemplateDocumentImage;
