import React from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";

export function Breadcrumb(props: any) {
  return (
    <>
      <nav className="sm:hidden" aria-label="Back">
        <Link
          href={
            props.items.length > 1 ? props.items[props.items.length - 2].href : props.items[0].href
          }
          className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700">
          <ChevronLeftIcon
            className="-ml-1 mr-1 h-5 w-5 flex-shrink-0 text-gray-400"
            aria-hidden="true"
          />
          Back
        </Link>
      </nav>
      <nav className="hidden sm:flex" aria-label="Breadcrumb">
        <ol role="list" className="flex items-center space-x-4">
          {props?.items.map((item: any, index: number) => (
            <React.Fragment key={item.href}>
              {index > 0 ? (
                <ChevronRightIcon
                  className="h-5 w-5 flex-shrink-0 text-gray-400"
                  aria-hidden="true"
                />
              ) : (
                ""
              )}
              <li>
                <div className="flex">
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700">
                    {item.title}
                  </Link>
                </div>
              </li>
            </React.Fragment>
          ))}
        </ol>
      </nav>
    </>
  );
}
