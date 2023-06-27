import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getUser } from "@documenso/lib/api";
import Logo from "./logo";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  ChartBarIcon,
  DocumentTextIcon,
  UserCircleIcon,
  WrenchIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import avatarFromInitials from "avatar-from-initials";
import { signOut, useSession } from "next-auth/react";
import { toast } from "react-hot-toast";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    current: false,
    icon: ChartBarIcon,
  },
  {
    name: "Documents",
    href: "/documents",
    current: false,
    icon: DocumentTextIcon,
  },
  {
    name: "Settings",
    href: "/settings/profile",
    current: true,
    icon: WrenchIcon,
  },
];

const userNavigation = [
  {
    name: "Your Profile",
    href: "/settings/profile",
    icon: UserCircleIcon,
  },
  {
    name: "Sign out",
    href: "",
    click: async (e: any) => {
      e.preventDefault();
      const res: any = await toast.promise(
        signOut({ callbackUrl: "/login" }),
        {
          loading: "Logging out...",
          success: "Your are logged out.",
          error: "Could not log out :/",
        },
        {
          style: {
            minWidth: "200px",
          },
          success: {
            duration: 10000,
          },
        }
      );
    },
    icon: ArrowRightOnRectangleIcon,
  },
];

function classNames(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

type UserType = {
  id?: number | undefined;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export default function TopNavigation() {
  const router = useRouter();
  const session = useSession();
  const [user, setUser] = useState({
    email: "",
    name: "",
  });

  useEffect(() => {
    getUser().then((res) => {
      res.json().then((j: any) => {
        setUser(j);
      });
    });
  }, [session]);

  navigation.forEach((element) => {
    element.current =
      router.route.endsWith("/" + element.href.split("/")[1]) ||
      router.route.includes(element.href.split("/")[1]);
  });

  return (
    <>
      <Disclosure as="nav" className="border-b border-gray-200 bg-white">
        {({ open, close }) => (
          <>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 justify-between">
                <div className="flex">
                  <Link
                    href="/dashboard"
                    className="flex flex-shrink-0 items-center gap-x-2 self-center overflow-hidden">
                    <Logo className="h-8 w-8 text-black" />
                  </Link>

                  <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={classNames(
                          item.current
                            ? "border-neon text-brown"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                          "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium"
                        )}
                        aria-current={item.current ? "page" : undefined}>
                        <item.icon
                          className="-ml-1 mr-3 inline h-6 w-6 flex-shrink-0"
                          aria-hidden="true"></item.icon>
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
                <div
                  onClick={() => {
                    document?.getElementById("mb")?.click();
                  }}
                  className="hidden cursor-pointer px-3 hover:bg-gray-200 sm:ml-6 sm:flex sm:items-center">
                  <span className="text-sm">
                    <p className="font-bold">{user?.name || ""}</p>
                    <p>{user?.email}</p>
                  </span>
                  <Menu as="div" className="relative ml-3">
                    <div>
                      <Menu.Button
                        id="mb"
                        className="flex max-w-xs items-center rounded-full bg-white text-sm">
                        <span className="sr-only">Open user menu</span>
                        <div
                          key={user?.email}
                          dangerouslySetInnerHTML={{
                            __html: avatarFromInitials(user?.name || "" || "", 40),
                          }}
                        />
                      </Menu.Button>
                    </div>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95">
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {userNavigation.map((item) => (
                          <Menu.Item key={item.name}>
                            {({ active }) => (
                              <Link
                                href={item.href}
                                onClick={item.click}
                                className={classNames(
                                  active ? "bg-gray-100" : "",
                                  "block px-4 py-2 text-sm text-gray-700"
                                )}>
                                <item.icon
                                  className="-ml-1 mr-3 inline h-6 w-6 flex-shrink-0"
                                  aria-hidden="true"></item.icon>
                                {item.name}
                              </Link>
                            )}
                          </Menu.Item>
                        ))}
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
                <div className="-mr-2 flex items-center sm:hidden">
                  {/* Mobile menu button */}
                  <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500">
                    <span className="sr-only">Open main menu</span>
                    {open ? (
                      <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                    )}
                  </Disclosure.Button>
                </div>
              </div>
            </div>

            <Disclosure.Panel className="sm:hidden">
              <div className="space-y-1 pt-2 pb-3">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={classNames(
                      item.current
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
                      "block border-l-4 py-2 pl-3 pr-4 text-base font-medium"
                    )}
                    aria-current={item.current ? "page" : undefined}
                    onClick={() => {
                      close();
                    }}>
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-4 pb-3">
                <div className="flex items-center px-4">
                  <div className="flex-shrink-0">
                    <div
                      key={user?.email}
                      dangerouslySetInnerHTML={{
                        __html: avatarFromInitials(user?.name || "" || "", 40),
                      }}
                    />
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">{user?.name || ""}</div>
                    <div className="text-sm font-medium text-gray-500">{user?.email}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {userNavigation.map((item) => (
                    <Link
                      key={item.name}
                      onClick={
                        item.href.includes("/settings/profile")
                          ? () => {
                              close();
                            }
                          : item.click
                      }
                      href={item.href}
                      className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
      {/* <Toaster position="top-center"></Toaster> */}
    </>
  );
}
