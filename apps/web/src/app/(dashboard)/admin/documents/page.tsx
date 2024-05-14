import { AdminDocumentResults } from './document-results';

export default function AdminDocumentsPage() {
  return (
    <div>
      <h2 className="text-4xl font-semibold">დოკუმენტების მართვა</h2>

      <div className="mt-8">
        <AdminDocumentResults />
      </div>
    </div>
  );
}
