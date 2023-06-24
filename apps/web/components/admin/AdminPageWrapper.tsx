import React, { ReactNode } from "react";
import Head from "next/head";
import Navbar from "./Navbar";

type Props = {
  children: ReactNode;
};

const AdminPageWrapper = (props: Props) => {
  return (
    <>
      <Head>
        <title>Admin | Dashboard</title>
      </Head>
      <Navbar />
      {props.children}
    </>
  );
};

export default AdminPageWrapper;
