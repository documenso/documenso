import React, { ReactNode } from 'react';
import Navbar from './Navbar';

type Props = {
  children: ReactNode;
};

const AdminPageWrapper = (props: Props) => {
  return (
    <>
      <Navbar />
      {props.children}
    </>
  );
};

export default AdminPageWrapper;
