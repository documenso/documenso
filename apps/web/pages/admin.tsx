import Head from "next/head";
import type { NextPageWithLayout } from "./_app";
import { ReactElement } from "react";
import Layout from "../components/layout";

const AdminPage: NextPageWithLayout = (props: any) => {
    return (
        <>
            <Head><title>Admin | Documenso</title></Head>
        </>
    )
}

AdminPage.getLayout = function getLayout(page: ReactElement) {
    return <Layout>{page}</Layout>
}
export default AdminPage