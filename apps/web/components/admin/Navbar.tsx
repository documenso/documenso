import React, { useState } from "react";
import Image from "next/image";
import styles from "./style.module.css";

type Props = {};

const Navbar = (props: Props) => {
  const [showSidebar, setShowSidebar] = useState(false);
  return (
    <>
      <div className="bg-neon-300 w-full p-4 font-medium shadow-lg">
        <span className="flex items-center justify-start">
          <img
            src={`https://img.icons8.com/?size=512&id=${showSidebar ? "46" : "3096"}&format=png`}
            className="mr-4 h-7 w-7 cursor-pointer duration-100"
            onClick={() => setShowSidebar(!showSidebar)}
          />
          Dashboard
        </span>
      </div>
      {showSidebar && <div className={showSidebar ? styles.sidebar : styles.sidebarExit}>s</div>}
    </>
  );
};

export default Navbar;
