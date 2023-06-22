import React, { useEffect, useState } from "react";
import AdminPageWrapper from "./AdminPageWrapper";
import Dropdown from '../Dropdown'
type Props = {
  users: User[]
};
type User = {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean | null;
  isAdmin: boolean;
};

const index = (props: Props) => {
  const [allUsers, setAllUsers] = useState(null)
  useEffect(() => {
    setAllUsers([...props.users])
  }, [props.users])
  const sortAscending = () => {
    const newSet = [...allUsers].sort((a, b) => a.id - b.id)
    setAllUsers(newSet);
  };
  return (
    <AdminPageWrapper>
      <div className="flex flex-col justify-center items-center">
        <div className="flex justify-between p-3 border w-3/4 text-slate-500">
          <div>
            Show Entries
            <Dropdown placeholder='25' />
          </div>
          <div className="w-1/2">
            <input placeholder="Search" className="p-3 w-full  rounded-md " />
          </div>
        </div>
        <table id="basic-data-table" className="table table-auto w-3/4 shadow-lg m-4 rounded-xl">
          <thead>
            <tr>
              <th className="px-4 py-2 text-center flex justify-evenly  ">Id
                <img src='https://img.icons8.com/?size=512&id=44296&format=png'
                  onClick={() => {
                    sortAscending()
                  }} className="h-3 w-3 cursor-pointer right-1" />
              </th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">email</th>
              <th className="px-4 py-2">emailVerified</th>
              <th className="px-4 py-2">isAdmin</th>
            </tr>
          </thead>
          <tbody>
            {allUsers?.map(user => (
              <tr key={user.id}>
                <td className="border px-4 py-2 text-center">{user.id}</td>
                <td className="border px-4 py-2 text-center">{user.name}</td>
                <td className="border px-4 py-2 text-center text-blue-500 cursor-pointer">{user.email}s</td>
                <td className="border px-4 py-2 text-center">{user.emailVerified}</td>
                <td className="border px-4 py-2 text-center">{user.isAdmin}</td>
              </tr>
            ))}


          </tbody>
        </table>
      </div>


    </AdminPageWrapper>
  )
};

export default index;
