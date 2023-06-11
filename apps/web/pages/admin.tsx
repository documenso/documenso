import Head from "next/head";
import type { NextPageWithLayout } from "./_app";
import { ReactElement, useEffect, useState } from "react";
import Layout from "../components/layout";
import { getAllUsers } from "@documenso/lib/api/admin/index";

const AdminPage: NextPageWithLayout = (props: any) => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getAllUsers().then((res) => {
      console.log(res);
      setUsers(res); // Store the users in the state
    });
  }, []);

  return (
    <>
      <Head>
        <title>Admin | Documenso</title>
      </Head>
          {/* Render your component using the users data */}
    </>
  );
};

AdminPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};
export default AdminPage;
