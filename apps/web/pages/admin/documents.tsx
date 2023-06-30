import type { NextPage } from "next";
import dynamic from "next/dynamic";

const DocumentAdminPage = dynamic(() => import("../../components/admin/documents"));
const Admin: NextPage = () => {
  return <DocumentAdminPage />;
};
export default Admin;
