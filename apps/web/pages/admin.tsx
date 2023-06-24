// in src/pages/admin.tsx
import { useEffect, useState } from "react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import { getAllUsers } from "@documenso/lib/api/admin/";

const AdminPage = dynamic(() => import("../components/admin"), { ssr: false });

const Admin: NextPage = () => {
  interface StateType {
    entries: number | null;
    totalPages: number | null;
    currentPage: number | null;
  }
  const initialState = {
    entries: 25,
    allUsers: [],
    totalPages: 0,
    currentPage: 1,
  };
  const [state, setState] = useState(initialState);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAllUsers(state.entries);
        setState((prevstate) => ({
          ...prevstate,
          allUsers: data.users,
          totalPages: data.totalPages,
          currentPage: data.page,
        }));
      } catch (error) {
        console.error(error);
      }
    };
    fetchData();
  }, [state.entries]);
  const setEntries = (value: number) => {
    setState((prevState) => ({
      ...prevState,
      entries: value,
    }));
  };
  console.log(state, "adminState");
  return <AdminPage {...state} onEntriesChange={setEntries} />;
};

export default Admin;
