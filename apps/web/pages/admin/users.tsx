// in src/pages/admin.tsx
import { useEffect, useState } from "react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import { getAllUsers } from "@documenso/lib/api/admin/";

const UserAdminPage = dynamic(() => import("../../components/admin"), { ssr: false });

const Admin: NextPage = () => {
  interface StateType {
    entries: number | null;
    totalPages: number | null;
    currentPage: number | null;
  }
  const initialState = {
    entries: 10,
    allUsers: [],
    totalPages: 0,
    currentPage: 1,
  };
  const [state, setState] = useState<StateType>(initialState);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAllUsers(state.currentPage, state.entries);
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
  }, [state.entries, state.currentPage]);

  const onChangeState = (key, value: number) => {
    setState((prevState) => ({
      ...prevState,
      [key]: value,
    }));
  };
  console.log(state, "adminState");
  return <UserAdminPage {...state} onEntriesChange={onChangeState} />;
};

export default Admin;
