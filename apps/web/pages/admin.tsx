// in src/pages/admin.tsx
import type { NextPage } from "next";
import dynamic from "next/dynamic";

const AdminPage = dynamic(() => import("../components/admin"), { ssr: false });

const Admin: NextPage = () => {
  return <AdminPage />;
};

export default Admin;