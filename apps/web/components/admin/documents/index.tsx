import React from "react";
import AdminPageWrapper from "../AdminPageWrapper";

type Props = {};

const index = (props: Props) => {
  return (
    <AdminPageWrapper>
      <div className="flex flex-col items-center justify-center">
        <div className="flex w-3/4 justify-between border p-3 text-slate-500"></div>
      </div>
    </AdminPageWrapper>
  );
};

export default index;
