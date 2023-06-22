// in src/pages/admin.tsx
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import { getAllUsers } from '@documenso/lib/api/admin/'
import { useEffect, useState } from "react";

const AdminPage = dynamic(() => import("../components/admin"), { ssr: false });

const Admin: NextPage = () => {
  const [allUsers, setAllUsers] = useState([])
  useEffect(() => {
    const fetchData = async () => {
      try {
        const users = await getAllUsers();
        setAllUsers(users)
      } catch (error) {
        console.error(error);
      }
    };
    fetchData();
  }, []);
  return <AdminPage users={allUsers} />;
};

export default Admin;
