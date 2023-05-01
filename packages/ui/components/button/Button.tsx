import React from "react";
import Link from "next/link";
import { classNames } from "@documenso/lib";

export function Button(props: any) {
  const isLink = typeof props.href !== "undefined" && !props.disabled;
  const { color = "primary", icon, disabled, onClick } = props;
  const baseStyles =
    "inline-flex gap-x-2 items-center justify-center min-w-[80px] rounded-md border border-transparent px-4 py-2 text-sm font-medium shadow-sm disabled:bg-gray-300 duration-200";
  const primaryStyles = "text-gray-900 bg-neon hover:bg-neon-dark";
  const secondaryStyles = "border-gray-300 bg-white text-gray-700 hover:bg-gray-50";

  return isLink ? (
    <Link
      id={props.id}
      href={props.href}
      className={classNames(
        baseStyles,
        color === "primary" ? primaryStyles : secondaryStyles,
        props.className
      )}
      hidden={props.hidden}>
      {props.icon ? (
        <props.icon className="inline-block h-5 text-inherit" aria-hidden="true"></props.icon>
      ) : (
        ""
      )}
      {props.children}
    </Link>
  ) : (
    <button
      id={props.id}
      type={props.type || "button"}
      className={classNames(
        baseStyles,
        color === "primary" ? primaryStyles : secondaryStyles,
        props.className
      )}
      onClick={props.onClick}
      disabled={props.disabled || props.loading}
      hidden={props.hidden}>
      {props.icon ? (
        <props.icon className="inline h-5 text-inherit" aria-hidden="true"></props.icon>
      ) : (
        ""
      )}
      {props.children}
    </button>
  );
}
