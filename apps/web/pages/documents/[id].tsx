import type { ReactElement } from "react";
import Layout from "../../components/layout";
import Settings from "../../components/settings";
import type { NextPageWithLayout } from "../_app";

const DocumentDetailPage: NextPageWithLayout = () => {
  return <p>this is the document page.</p>;
};

DocumentDetailPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DocumentDetailPage;
