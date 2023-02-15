import { classNames } from "@documenso/lib";
import Link from "next/link";
import React from "react";

export function Button(props: any) {
  const isLink = typeof props.href !== "undefined";
  const { color = "primary", icon, disabled, onClick } = props;
  const baseStyles =
    "inline-flex items-center justify-center min-w-[80px] rounded-2xl border border-transparent px-4 py-3 text-sm font-medium shadow-sm disabled:bg-gray-300   transition-all duration-300  ";
  const primaryStyles =
    "text-gray-900 bg-neon hover:bg-neon-dark  ";
  const secondaryStyles =
    "border-brown/30 bg-white text-brown hover:bg-brown hover:text-white hover:shadow-xl shadow-md hover:shadow-3xl shadow-gray-500/20 hover:shadow-slate-600/30 hover:-translate-y-1 ";

  return isLink ? (
    <Link
      id={props.id}
      href={props.href}
      className={classNames(
        baseStyles,
        color === "primary" ? primaryStyles : secondaryStyles,
        props.className
      )}
      hidden={props.hidden}
    >
      {props.icon ? (
        <props.icon
          className="inline h-5 mr-1 text-inherit"
          aria-hidden="true"
        ></props.icon>
      ) : (
        ""
      )}
      {props.children}
    </Link>
  ) : (
    <button
      id={props.id}
      type="button"
      className={classNames(
        baseStyles,
        color === "primary" ? primaryStyles : secondaryStyles,
        props.className
      )}
      onClick={props.onClick}
      disabled={props.disabled || props.loading}
      hidden={props.hidden}
    >
      {props.icon ? (
        <props.icon
          className="inline h-5 mr-1 text-inherit"
          aria-hidden="true"
        ></props.icon>
      ) : (
        ""
      )}
      {props.children}
    </button>
  );
}
