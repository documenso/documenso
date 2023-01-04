import { useSession } from "next-auth/react";
import type { ReactElement } from "react";
import Layout from "../components/layout";
import Settings from "../components/settings";
import type { NextPageWithLayout } from "./_app";
import { SessionProvider } from "next-auth/react";

const DocumentsPage: NextPageWithLayout = () => {
  const { data: session } = useSession();

  return <>This is the documents page</>;
};

DocumentsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DocumentsPage;
