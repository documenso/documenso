/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useState } from "react";
import { Fragment } from "react";
import { Button } from "@documenso/ui";
import Dropdown from "../Dropdown";
import AdminPageWrapper from "./AdminPageWrapper";
import UserRow from "./UserRow";
import { Dialog, Transition } from "@headlessui/react";

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
  const sortAscending = () => {
    const newSet = [...allUsers].sort((a, b) => a.id - b.id);
    setAllUsers(newSet);
  };
  const [user, setUser] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  return (
    <AdminPageWrapper>
      <div className="flex flex-col items-center justify-center">
        <div className="flex w-3/4 justify-between border p-3 text-slate-500">
          <Transition.Root show={showPopup} as={Fragment}>
            <Dialog
              as="div"
              className=" relative"
              onClose={() => {
                setShowPopup(false);
              }}>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
              </Transition.Child>
              <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                    enterTo="opacity-100 translate-y-0 sm:scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                    leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                    <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left font-mono shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                      <div className="flex justify-start">
                        <Dialog.Title className="text-lg font-semibold">User Details</Dialog.Title>
                      </div>
                      <Dialog.Description>
                        <input value="user1" className="p-1" />
                      </Dialog.Description>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition.Root>
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
              <UserRow user={user} key={user.id} setShowPopup={setShowPopup} />
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageWrapper>
  );
};

export default index;
