import { Fragment } from "react";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { Bars3Icon, BellIcon, XMarkIcon } from "@heroicons/react/24/outline";

const user = {
  name: "Timur Ercan",
  email: "timur@documenso.com",
  imageUrl:
    "https://pbs.twimg.com/profile_images/1382036502390181888/4BT30oTM_400x400.jpg",
};
const navigation = [
  { name: "Dashboard", href: "#", current: true },
  { name: "Team", href: "#", current: false },
  { name: "Settings", href: "#" },
];
const userNavigation = [
  { name: "Your Profile", href: "#" },
  { name: "Sign out", href: "#" },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Layout({ children }) {
  return (
    <>
      <div className="min-h-full">
        <Disclosure as="nav" className="border-b border-gray-200 bg-white">
          {({ open }) => (
            <>
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 justify-between">
                  <div className="flex">
                    <div className="flex flex-shrink-0 items-center">
                      <svg
                        className="w-12"
                        viewBox="0 0 88.6758041381836 32.18000030517578"
                      >
                        <rect
                          width="88.6758041381836"
                          height="32.18000030517578"
                          fill="transparent"
                        ></rect>
                        <g transform="matrix(1,0,0,1,-25.98720359802246,-66.41200256347656)">
                          <path
                            d="M99.004,68.26l-.845-1.848-23.226,2.299c-1.437,.142-2.876,.089-4.3-.156-2.949-.51-6.32-1.717-9.073-2.099-1.477-.206-2.934,.448-3.789,1.67-1.174,1.678-2.308,3.888-3.501,5.622-1.518,2.207-3.032,4.418-4.531,6.638-1.693,2.499-3.365,5.013-5.061,7.51-.103,.153-.333,.221-.503,.329-.079-.279-.306-.636-.206-.824,1.006-1.928,1.845-4,3.165-5.694,1.908-2.449,2.914-5.445,5.007-7.745,.342-.777,.845-1.466,1.151-2.244,.915-2.341-1.295-5.305-2.935-5.305h-.613c-1.196,0-2.526,.357-4.092,1.716-.986,.856-2.391,2.432-2.97,3.326-3.424,5.286-7.177,10.382-10.15,15.932-.365,.682-1.719,3.722-2.013,3.606-.214-.077-.159-.458-.041-.823,1.312-4.065,4.163-9.851,5.843-13.777,.41-.962,.635-1.516-.305-2.361-1.016-.913-2.669,.084-3.084,1.052-1.784,4.174-2.631,8.08-4.038,12.396-.466,1.43-.916,2.865-1.386,4.294-.273,.831-.548,1.661-.836,2.488-.112,.321-.226,.642-.345,.962-.032,.082-.064,.165-.095,.248-.006,.011-.003,.002-.009,.017-.005,.008-.003,.015-.006,.023-.011,.026-.021,.05-.03,.076-.024,.067-.012,.044,.009-.002-.691,1.577,.417,3.002,2.091,3.002,.808,0,1.552-1.431,1.943-2.055,1.224-1.957,3.28-5.125,4.36-7.163,.894-1.69,2.078-3.14,3.209-4.615,1.857-2.42,3.065-5.242,5.025-7.575,.33-.394,.694-.772,1.093-1.093,.121-.098,.473-.05,.618,.062,.124,.098,.2,.432,.127,.577-.397,.788-.863,1.542-1.278,2.322-1.481,2.79-2.953,5.582-4.425,8.377-1.16,2.204-2.659,5.055-3.551,6.755-.438,.833-.176,1.857,.604,2.382,0,0-.383,2.028,1.908,2.028,1.896,0,2.711-1.145,3.053-1.624,.348-.486,.748-.951,1.202-1.334,.151-.13,.563-.018,.821,.079,.076,.029,.085,.406,.03,.582-.398,1.272-.323,2.283,1.879,2.283,.784,0,2.218-1.283,2.904-2.213,.794-1.075,.731-1.1,1.415-2.244,1.678-2.821,3.132-5.055,4.751-7.91,1.083-1.91,2.175-3.854,3.294-5.516,.685-1.015,1.446-1.252,2.188-1.252s.409,.686,.336,1.025c-.071,.341-.677,1.545-2.531,4.35-1.115,1.687-2.244,3.367-3.308,5.084-1.075,1.736-2.141,3.48-3.205,5.225-.88,1.445,.162,3.467,1.854,3.467h2.765c2.653,0,5.302-.397,7.916-.851l7.41-1.287c1.421-.245,2.868-.298,4.303-.158l23.161,2.296,.845-1.849c4.61-9.858,15.211-11.322,15.66-11.38v-5.717c-.448-.058-11.05-1.522-15.66-11.381Zm-40.143,6.165c-.164,.465-.491,.922-.86,1.255-.918,.828-1.451,1.842-1.911,2.977-.512,1.269-1.829,2.119-1.966,3.65-.027,.3-.627,.577-1.006,.797-.109,.062-.357-.114-.524-.174,.015-.229-.024-.401,.039-.515,.848-1.495,1.678-3.002,2.584-4.462,.775-1.254,1.642-2.453,2.469-3.677,.085-.126,.158-.273,.27-.365,.457-.368,.93-.719,1.399-1.075,.497,.721-.312,1.071-.494,1.589Zm30.047,12.011c1.736,0,3.162-1.137,3.686-2.693h10.547c-3.02,1.916-6.1,4.684-8.402,8.716l-21.902-2.17v-15.584l21.902-2.167c2.302,4.032,5.382,6.802,8.402,8.714h-10.547c-.524-1.554-1.951-2.691-3.686-2.691-2.172,0-3.938,1.763-3.938,3.938s1.766,3.938,3.938,3.938Z"
                            className="fill-brown"
                          ></path>
                        </g>
                      </svg>
                    </div>
                    <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                      {navigation.map((item) => (
                        <a
                          key={item.name}
                          href={item.href}
                          className={classNames(
                            item.current
                              ? "border-neon text-brown"
                              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                            "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                          )}
                          aria-current={item.current ? "page" : undefined}
                        >
                          {item.name}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="hidden sm:ml-6 sm:flex sm:items-center">
                    <button
                      type="button"
                      className="rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      <span className="sr-only">View notifications</span>
                      <BellIcon className="h-6 w-6" aria-hidden="true" />
                    </button>

                    {/* Profile dropdown */}
                    <Menu as="div" className="relative ml-3">
                      <div>
                        <Menu.Button className="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                          <span className="sr-only">Open user menu</span>
                          <img
                            className="h-8 w-8 rounded-full"
                            src={user.imageUrl}
                            alt=""
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
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                          {userNavigation.map((item) => (
                            <Menu.Item key={item.name}>
                              {({ active }) => (
                                <a
                                  href={item.href}
                                  className={classNames(
                                    active ? "bg-gray-100" : "",
                                    "block px-4 py-2 text-sm text-gray-700"
                                  )}
                                >
                                  {item.name}
                                </a>
                              )}
                            </Menu.Item>
                          ))}
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  </div>
                  <div className="-mr-2 flex items-center sm:hidden">
                    {/* Mobile menu button */}
                    <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                      <span className="sr-only">Open main menu</span>
                      {open ? (
                        <XMarkIcon
                          className="block h-6 w-6"
                          aria-hidden="true"
                        />
                      ) : (
                        <Bars3Icon
                          className="block h-6 w-6"
                          aria-hidden="true"
                        />
                      )}
                    </Disclosure.Button>
                  </div>
                </div>
              </div>

              <Disclosure.Panel className="sm:hidden">
                <div className="space-y-1 pt-2 pb-3">
                  {navigation.map((item) => (
                    <Disclosure.Button
                      key={item.name}
                      as="a"
                      href={item.href}
                      className={classNames(
                        item.current
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                          : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800",
                        "block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
                      )}
                      aria-current={item.current ? "page" : undefined}
                    >
                      {item.name}
                    </Disclosure.Button>
                  ))}
                </div>
                <div className="border-t border-gray-200 pt-4 pb-3">
                  <div className="flex items-center px-4">
                    <div className="flex-shrink-0">
                      <img
                        className="h-10 w-10 rounded-full"
                        src={user.imageUrl}
                        alt=""
                      />
                    </div>
                    <div className="ml-3">
                      <div className="text-base font-medium text-gray-800">
                        {user.name}
                      </div>
                      <div className="text-sm font-medium text-gray-500">
                        {user.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ml-auto flex-shrink-0 rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      <span className="sr-only">View notifications</span>
                      <BellIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3 space-y-1">
                    {userNavigation.map((item) => (
                      <Disclosure.Button
                        key={item.name}
                        as="a"
                        href={item.href}
                        className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      >
                        {item.name}
                      </Disclosure.Button>
                    ))}
                  </div>
                </div>
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>

        <div className="py-10">
          <header>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-brown">
                Dashboard
              </h1>
            </div>
          </header>
          <main>
            <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
              {/* Replace with your content */}
              <div className="px-4 py-8 sm:px-0">
                <div className="h-96 rounded-lg border-2 border-dashed border-gray-900">
                  {children}
                </div>
              </div>
              {/* /End replace */}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
