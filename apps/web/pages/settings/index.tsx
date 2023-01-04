import type { ReactElement } from "react";
import Layout from "../../components/layout";
import Settings from "../../components/settings";
import type { NextPageWithLayout } from "../_app";

const SettingsPage: NextPageWithLayout = () => {
  return <Settings></Settings>;
};

SettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default SettingsPage;
