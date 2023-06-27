/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useState } from "react";
import { Button } from "@documenso/ui";
import Dropdown from "../Dropdown";
import AdminPageWrapper from "./AdminPageWrapper";
import UserRow from "./UserRow";
import { getUserDetails } from "@documenso/lib/api/admin/"
import UserDetailPopup from './UserDetailPopup'

type Props = {
  allUsers: User[];
  totalPages: number;
  entries: number;
  currentPage: number;
  onEntriesChange: (key, value: number) => void;
};
type User = {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean | null;
  isAdmin: boolean;
};

const index = (props: Props) => {
  const [allUsers, setAllUsers] = useState<User[]>(null);
  useEffect(() => {
    setAllUsers([...props.allUsers]);
  }, [props.allUsers]);
  const [userId, setUserId] = useState<number | null>(null);
  const [userDetails, setUserDetails] = useState([])
  useEffect(() => {
    if (!userId) {
      return
    }
    getUserDetails(userId).then(res => {
      setUserDetails(res)
    })
  }, [userId])
  const sortAscending = () => {
    const newSet = [...allUsers].sort((a, b) => a.id - b.id);
    setAllUsers(newSet);
  };
  const [showPopup, setShowPopup] = useState(false);
  return (
    <AdminPageWrapper>
      <div className="flex flex-col items-center justify-center">
        <div className="flex w-3/4 justify-between border p-3 text-slate-500">
          <UserDetailPopup
            showPopup={showPopup}
            setShowPopup={setShowPopup}
            userDetails={userDetails}
            setUserDetails={setUserDetails}
          />
          <div>
            Show Entries
            <Dropdown
              placeholder="Select entrys"
              value={props.entries}
              options={[
                { text: "10", value: 10 },
                { text: "25", value: 25 },
                { text: "50", value: 50 },
                { text: "75", value: 75 },
                { text: "100", value: 100 },
              ]}
              onChange={(value: number) => {
                props.onEntriesChange("entries", value);
              }}
            />
          </div>
          <div className="flex justify-between">
            <Button
              className="m-1"
              disabled={props.currentPage === 1}
              onClick={() => props.onEntriesChange("currentPage", props.currentPage - 1)}>
              Previous
            </Button>
            <Button
              className="m-1"
              disabled={props.currentPage === props.totalPages}
              onClick={() => props.onEntriesChange("currentPage", props.currentPage + 1)}>
              Next
            </Button>
          </div>
          <div className="w-1/2">
            <input
              placeholder="Enter email"
              className="w-full rounded-md  p-3 "
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <table
          id="basic-data-table"
          className="m-4 table w-3/4 table-auto rounded-xl shadow-lg duration-500">
          <thead>
            <tr>
              <th className="flex justify-evenly px-4 py-2 text-center  ">
                Id
                <img
                  src="https://img.icons8.com/?size=512&id=44296&format=png"
                  onClick={() => {
                    sortAscending();
                  }}
                  className="right-1 h-3 w-3 cursor-pointer"
                />
              </th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">email</th>
              <th className="px-4 py-2">emailVerified</th>
              <th className="px-4 py-2">isAdmin</th>
            </tr>
          </thead>
          <tbody>
            {allUsers?.map((user) => (
              <UserRow user={user} key={user.id} setShowPopup={setShowPopup} setUser={setUserId} />
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageWrapper>
  );
};

export default index;
