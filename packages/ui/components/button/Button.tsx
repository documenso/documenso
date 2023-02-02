import { classNames } from "@documenso/lib";
import Link from "next/link";
import React from "react";
import { Tooltip } from "react-tooltip";
import short from "short-uuid";

export function Button(props: any) {
  const isLink = typeof props.href !== "undefined";
  const { color = "primary", icon, disabled, onClick } = props;
  const baseStyles =
    "inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm sm:w-auto disabled:bg-gray-300";
  const primaryStyles = "bg-neon hover:bg-neon-dark";
  const secondaryStyles =
    "border-gray-300 bg-white text-gray-700 hover:bg-gray-50";

  return isLink ? (
    <Link id={props.id} href={props.href} className={classNames(baseStyles)}>
      {props.children}
    </Link>
  ) : (
    <button
      id={props.id}
      className={classNames(
        baseStyles,
        color === "primary" ? primaryStyles : secondaryStyles
      )}
      onClick={props.onClick}
      {...props}
    >
      <props.icon className="inline text-inherit w-4 mr-1"></props.icon>
      {props.children}
    </button>
  );
}
