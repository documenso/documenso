import { Fragment, useState } from "react";
import { Disclosure, Menu, Switch, Transition } from "@headlessui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import {
  Bars3Icon,
  BellIcon,
  CogIcon,
  CreditCardIcon,
  KeyIcon,
  SquaresPlusIcon,
  UserCircleIcon,
  XMarkIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";

const user = {
  name: "Debbie Lewis",
  handle: "deblewis",
  email: "debbielewis@example.com",
  imageUrl:
    "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=4&w=320&h=320&q=80",
};

const subNavigation = [
  {
    name: "Profile",
    href: "/settings/profile",
    icon: UserCircleIcon,
    current: true,
  },
  {
    name: "Password",
    href: "/settings/password",
    icon: KeyIcon,
    current: false,
  },
  {
    name: "Account",
    href: "/settings/account",
    icon: CogIcon,
    current: false,
  },
];

function classNames(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

export default function Setttings() {
  const [availableToHire, setAvailableToHire] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [allowCommenting, setAllowCommenting] = useState(true);
  const [allowMentions, setAllowMentions] = useState(true);

  const router = useRouter();
  console.log(router.route);
  subNavigation.forEach((element) => {
    element.current = element.href == router.route;
  });

  return (
    <div>
      <Head>
        <title>Settings | Documenso</title>
      </Head>
      <header className="py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-brown">
            Settings
          </h1>
        </div>
      </header>
      <div className="mx-auto max-w-screen-xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-16">
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="divide-y divide-gray-200 lg:grid lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
            <aside className="py-6 lg:col-span-3">
              <nav className="space-y-1">
                {subNavigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={classNames(
                      item.current
                        ? "bg-teal-50 border-teal-500 text-teal-700 hover:bg-teal-50 hover:text-teal-700"
                        : "border-transparent text-gray-900 hover:bg-gray-50 hover:text-gray-900",
                      "group border-l-4 px-3 py-2 flex items-center text-sm font-medium"
                    )}
                    aria-current={item.current ? "page" : undefined}
                  >
                    <item.icon
                      className={classNames(
                        item.current
                          ? "text-teal-500 group-hover:text-teal-500"
                          : "text-gray-400 group-hover:text-gray-500",
                        "flex-shrink-0 -ml-1 mr-3 h-6 w-6"
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </aside>

            <form
              className="divide-y divide-gray-200 lg:col-span-9"
              action="#"
              method="POST"
            >
              {/* Profile section */}
              <div className="py-6 px-4 sm:p-6 lg:pb-8">
                <div>
                  <h2 className="text-lg font-medium leading-6 text-gray-900">
                    Profile
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Let people know who they are dealing with builds trust.
                    Leave your profile blank and your email will be used as your
                    name.
                  </p>
                </div>

                <div className="mt-6 flex flex-col lg:flex-row">
                  <div className="mt-6 flex-grow lg:mt-0 lg:ml-6 lg:flex-shrink-0 lg:flex-grow-0">
                    <p
                      className="text-sm font-medium text-gray-700"
                      aria-hidden="true"
                    >
                      Photo
                    </p>
                    <div className="mt-1 lg:hidden">
                      <div className="flex items-center">
                        <div
                          className="inline-block h-12 w-12 flex-shrink-0 overflow-hidden rounded-full"
                          aria-hidden="true"
                        >
                          <img
                            className="h-full w-full rounded-full"
                            src={user.imageUrl}
                            alt=""
                          />
                        </div>
                        <div className="ml-5 rounded-md shadow-sm">
                          <div className="group relative flex items-center justify-center rounded-md border border-gray-300 py-2 px-3 focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 hover:bg-gray-50">
                            <label
                              htmlFor="mobile-user-photo"
                              className="pointer-events-none relative text-sm font-medium leading-4 text-gray-700"
                            >
                              <span>Change</span>
                              <span className="sr-only"> user photo</span>
                            </label>
                            <input
                              id="mobile-user-photo"
                              name="user-photo"
                              type="file"
                              className="absolute h-full w-full cursor-pointer rounded-md border-gray-300 opacity-0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative hidden overflow-hidden rounded-full lg:block">
                      <img
                        className="relative h-40 w-40 rounded-full"
                        src={user.imageUrl}
                        alt=""
                      />
                      <label
                        htmlFor="desktop-user-photo"
                        className="absolute inset-0 flex h-full w-full items-center justify-center bg-black bg-opacity-75 text-sm font-medium text-white opacity-0 focus-within:opacity-100 hover:opacity-100"
                      >
                        <span>Change</span>
                        <span className="sr-only"> user photo</span>
                        <input
                          type="file"
                          id="desktop-user-photo"
                          name="user-photo"
                          className="absolute inset-0 h-full w-full cursor-pointer rounded-md border-gray-300 opacity-0"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-12 gap-6">
                  <div className="col-span-12 sm:col-span-6">
                    <label
                      htmlFor="first-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      First name
                    </label>
                    <input
                      type="text"
                      name="first-name"
                      id="first-name"
                      autoComplete="given-name"
                      className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label
                      htmlFor="last-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Last name
                    </label>
                    <input
                      type="text"
                      name="last-name"
                      id="last-name"
                      autoComplete="family-name"
                      className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label
                      htmlFor="company"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Company
                    </label>
                    <input
                      type="text"
                      name="company"
                      id="company"
                      autoComplete="organization"
                      className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Privacy section */}
              <div className="divide-y divide-gray-200 pt-6">
                <div className="px-4 sm:px-6">
                  <div>
                    <h2 className="text-lg font-medium leading-6 text-gray-900">
                      Privacy
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Ornare eu a volutpat eget vulputate. Fringilla commodo
                      amet.
                    </p>
                  </div>
                  <ul role="list" className="mt-2 divide-y divide-gray-200">
                    <Switch.Group
                      as="li"
                      className="flex items-center justify-between py-4"
                    >
                      <div className="flex flex-col">
                        <Switch.Label
                          as="p"
                          className="text-sm font-medium text-gray-900"
                          passive
                        >
                          Available to hire
                        </Switch.Label>
                        <Switch.Description className="text-sm text-gray-500">
                          Nulla amet tempus sit accumsan. Aliquet turpis sed sit
                          lacinia.
                        </Switch.Description>
                      </div>
                      <Switch
                        checked={availableToHire}
                        onChange={setAvailableToHire}
                        className={classNames(
                          availableToHire ? "bg-teal-500" : "bg-gray-200",
                          "relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={classNames(
                            availableToHire ? "translate-x-5" : "translate-x-0",
                            "inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                          )}
                        />
                      </Switch>
                    </Switch.Group>
                  </ul>
                </div>
                <div className="mt-4 flex justify-end py-4 px-4 sm:px-6">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-sky-700 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
