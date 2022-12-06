import React, { ReactNode } from "react";

interface Props {
  children?: any;
}

export default function Layout({ children }: Props) {
  return (
    <>
      <div>Header</div>
      <main>{children}</main>
      <div>Footer</div>
    </>
  );
}
