import { NextPageContext } from "next";
import { getSession } from "next-auth/react";

function RedirectPage() {
  return;
}

export async function getServerSideProps(context: NextPageContext) {
  const session = await getSession(context);

  if (!session?.user?.email) {
    return { redirect: { permanent: false, destination: "/login" } };
  }

  return { redirect: { permanent: false, destination: "/dashboard" } };
}

export default RedirectPage;
