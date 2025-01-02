import { useSearchParams } from 'react-router';

export function meta() {
  return [{ title: 'Documents' }];
}

export default function DocumentsPage() {
  const [searchParams] = useSearchParams();

  return (
    <>
      <div>hello</div>
      {/* <DocumentsPageView searchParams={searchParams} /> */}
    </>
  );
}
