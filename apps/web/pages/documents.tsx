import type { ReactElement } from "react";
import Layout from "../components/layout";
import Settings from "../components/settings";
import type { NextPageWithLayout } from "./_app";

const TeamPage: NextPageWithLayout = () => {
  return <>This is the documents page</>;
};

TeamPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default TeamPage;
