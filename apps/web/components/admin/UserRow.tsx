import React, { useState } from "react";

type Props = {};

const UserRow = (props: {
  user: {
    id: number;
    name: string;
    email: string;
    emailVerified: boolean | null;
    isAdmin: boolean;
  };
  setShowPopup: (val: boolean) => void;
  setUser: (id: number) => void;
}) => {
  const { user } = props;
  return (
    <>
      <tr
        key={user.id}
        className="hover:bg-neon-100 cursor-pointer"
        onClick={() => {
          props.setShowPopup(true);
          props.setUser(user.id);
        }}>
        <td className="border px-4 py-2 text-center">{user.id}</td>
        <td className="border px-4 py-2 text-center">{user.name}</td>
        <td className="cursor-pointer border px-4 py-2 text-center text-blue-500">{user.email}s</td>
        <td className="border px-4 py-2 text-center">{user.emailVerified}</td>
        <td className="border px-4 py-2 text-center">{user.isAdmin}</td>
      </tr>
    </>
  );
};
export default UserRow;
