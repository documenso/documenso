import { DeleteDocumentModal } from '../../../delete-document-modal';

export type DeleteModalPageProps = {
  params: {
    id: string;
  };
};

export default function DeleteModalPage({ params: { id } }: DeleteModalPageProps) {
  const documentId = Number(id);
  return <DeleteDocumentModal id={documentId} />;
}
