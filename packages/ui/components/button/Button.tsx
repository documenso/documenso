import React, { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { classNames } from "@documenso/lib";
import { SVGComponent } from "@documenso/lib/types";
import { Url } from "url";

interface Props {
  id?: string;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
  icon?: SVGComponent;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  hidden?: boolean;
  className?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
}

export function Button(props: React.PropsWithChildren<Props>) {
  const { color = "primary" } = props;
  const isLink = typeof props.href !== "undefined" && !props.disabled;
  const baseStyles =
    "inline-flex gap-x-2 items-center justify-center min-w-[80px] rounded-md border border-transparent px-4 py-2 text-sm font-medium shadow-sm disabled:bg-gray-300 duration-200";
  const primaryStyles = "text-gray-900 bg-neon hover:bg-neon-dark";
  const secondaryStyles = "border-gray-300 bg-white text-gray-700 hover:bg-gray-50";

  return isLink ? (
    <Link
      id={props.id}
      href={props.href as unknown as Url}
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
