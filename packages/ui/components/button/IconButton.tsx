import React, { PropsWithChildren } from "react";
import Link from "next/link";
import { classNames } from "@documenso/lib";
import { SVGComponent } from "@documenso/lib/types";
import { URL } from "url";

interface Props {
  id?: string;
  href?: string;
  disabled?: boolean;
  color?: string;
  icon?: SVGComponent;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  hidden?: boolean;
  className?: string;
}

export function IconButton(props: PropsWithChildren<Props>) {
  const isLink = typeof props.href !== "undefined";
  const { color = "primary" } = props;
  const baseStyles = "disabled:text-gray-300";
  const primaryStyles = "text-neon hover:text-neon-dark";
  const secondaryStyles = "text-gray-700 hover:text-neon-dark";

  return isLink ? (
    <Link
      id={props.id}
      href={props.href as unknown as URL}
      className={classNames(
        baseStyles,
        color === "primary" ? primaryStyles : secondaryStyles,
        props.className
      )}
      hidden={props.hidden}>
      {props.icon ? (
        <props.icon className="mr-1 inline h-6 text-inherit" aria-hidden="true"></props.icon>
      ) : (
        ""
      )}
      {props.children}
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
      hidden={props.hidden}>
      {props.icon ? (
        <props.icon className="mr-1 inline h-6 text-inherit" aria-hidden="true"></props.icon>
      ) : (
        ""
      )}
      {props.children}
    </button>
  );
}
