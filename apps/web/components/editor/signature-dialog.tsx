import { classNames } from "@documenso/lib";
import { Button, IconButton } from "@documenso/ui";
import { Dialog, Transition } from "@headlessui/react";
import {
  BuildingOfficeIcon,
  CreditCardIcon,
  LanguageIcon,
  PencilIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { Fragment, useState } from "react";

const tabs = [
  { name: "Type", href: "#", icon: LanguageIcon, current: true },
  { name: "Draw", href: "#", icon: PencilIcon, current: false },
];

export default function SignatureDialog(props: any) {
  const [currentTab, setCurrentTab] = useState(tabs[0]);

  return (
    <>
      <Transition.Root show={props.open} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={props.setOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                  <div className="">
                    <div className="border-b border-gray-200 mb-3">
                      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {tabs.map((tab) => (
                          <Fragment>
                            <a
                              key={tab.name}
                              onClick={() => {
                                setCurrent(tab);
                              }}
                              className={classNames(
                                tab.current
                                  ? "border-neon text-neon"
                                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                                "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm cursor-pointer"
                              )}
                              aria-current={tab.current ? "page" : undefined}
                            >
                              <tab.icon
                                className={classNames(
                                  tab.current
                                    ? "text-neon"
                                    : "text-gray-400 group-hover:text-gray-500",
                                  "-ml-0.5 mr-2 h-5 w-5"
                                )}
                                aria-hidden="true"
                              />
                              <span>{tab.name}</span>
                            </a>
                          </Fragment>
                        ))}
                      </nav>
                    </div>
                    {isCurrentTab("Type") ? (
                      <div className="my-8 min-h-[50px]">
                        <input
                          type="email"
                          name="email"
                          id="email"
                          className="mt-3 pb-1 text-center block border-b w-full border-gray-300 focus:border-neon focus:ring-neon text-2xl"
                          placeholder="Kindly type your name"
                        />
                      </div>
                    ) : (
                      ""
                    )}
                    {isCurrentTab("Draw") ? (
                      <div className="my-8 min-h-[50px]">draw</div>
                    ) : (
                      ""
                    )}
                  </div>
                  <div className="float-right">
                    <Button
                      color="secondary"
                      onClick={() => props.setOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button className="ml-3">Sign</Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );

  function isCurrentTab(tabName: string): boolean {
    return currentTab.name === tabName;
  }

  function setCurrent(t: any) {
    tabs.forEach((tab) => {
      tab.current = tab.name === t.name;
    });
    setCurrentTab(t);
  }
}
