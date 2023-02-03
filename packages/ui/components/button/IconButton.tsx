import { classNames } from "@documenso/lib";
import Link from "next/link";
import React from "react";

export function IconButton(props: any) {
  const isLink = typeof props.href !== "undefined";
  const { color = "primary", icon, disabled, onClick } = props;
  const baseStyles = "disabled:text-gray-300";
  const primaryStyles = "text-neon hover:text-neon-dark";
  const secondaryStyles = "text-gray-700 hover:text-neon-dark";

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
          className="inline text-inherit h-6 mr-1"
          aria-hidden="true"
        ></props.icon>
      ) : (
        ""
      )}
    </Link>
  ) : (
    <button
      id={props.id}
      className={classNames(
        baseStyles,
        color === "primary" ? primaryStyles : secondaryStyles,
        props.className
      )}
      onClick={props.onClick}
      disabled={props.disabled}
      hidden={props.hidden}
    >
      {props.icon ? (
        <props.icon
          className="inline text-inherit h-6 mr-1"
          aria-hidden="true"
        ></props.icon>
      ) : (
        ""
      )}
    </button>
  );
}
