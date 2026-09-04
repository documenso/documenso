import { Column, Img, Row, Section } from '../components';

export interface TemplateDocumentImageProps {
  assetBaseUrl: string;
  className?: string;
}

export const TemplateDocumentImage = ({ assetBaseUrl, className }: TemplateDocumentImageProps) => {
  const getAssetUrl = (path: string) => {
    // Resolve against a trailing-slash base so a sub-path (e.g. "/ESign") in assetBaseUrl is preserved.
    const base = assetBaseUrl.endsWith('/') ? assetBaseUrl : `${assetBaseUrl}/`;
    return new URL(path.replace(/^\//, ''), base).toString();
  };

  return (
    <Section className={className}>
      <Row className="table-fixed">
        <Column />

        <Column>
          <Img className="mx-auto h-42" src={getAssetUrl('/static/document.png')} alt="Documenso" />
        </Column>

        <Column />
      </Row>
    </Section>
  );
};

export default TemplateDocumentImage;
