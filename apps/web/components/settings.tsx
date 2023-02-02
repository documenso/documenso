import { ChangeEvent, useEffect, useState } from "react";
import { KeyIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { updateUser } from "@documenso/features";
import { Button } from "@documenso/ui";

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
];

function classNames(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

export default function Setttings() {
  const session = useSession();
  const [user, setUser] = useState({
    email: "",
    name: "",
  });

  useEffect(() => {
    fetch("/api/users/me").then((res) => {
      res.json().then((j) => {
        setUser(j);
      });
    });
  }, [session]);

  const router = useRouter();
  subNavigation.forEach((element) => {
    element.current = element.href == router.route;
  });

  const [savingTimeout, setSavingTimeout] = useState<any>();
  function handleNameChange(e: ChangeEvent<HTMLInputElement>): void {
    let u = { ...user };
    u.name = e.target.value;
    setUser(u);
    clearTimeout(savingTimeout);
    const t = setTimeout(() => {
      updateUser(u);
    }, 1000);

    setSavingTimeout(t);
  }

  const handleKeyPress = (event: any) => {
    if (event.key === "Enter") {
      clearTimeout(savingTimeout);
      updateUser(user);
    }
  };

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
      <div
        className="mx-auto max-w-screen-xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-16"
        hidden={!user.email}
      >
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
                        ? "bg-teal-50 border-neon-dark text-teal-700 hover:bg-teal-50 hover:text-teal-700"
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
                  </p>
                </div>

                <div className="my-6 grid grid-cols-12 gap-6">
                  <div className="col-span-12 sm:col-span-6">
                    <label
                      htmlFor="first-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="first-name"
                      id="first-name"
                      value={user?.name || ""}
                      onChange={(e) => handleNameChange(e)}
                      onKeyDown={handleKeyPress}
                      autoComplete="given-name"
                      className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-neon focus:outline-none focus:ring-neon sm:text-sm"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6">
                    <label
                      htmlFor="first-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Email
                    </label>
                    <input
                      disabled
                      value={user?.email!}
                      type="text"
                      name="first-name"
                      id="first-name"
                      autoComplete="given-name"
                      className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-neon focus:outline-none focus:ring-neon sm:text-sm"
                    />
                  </div>
                </div>
                <Button onClick={() => updateUser(user)}>Save</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="mt-10 max-w-[1100px]" hidden={!!user.email}>
        <div className="ph-item">
          <div className="ph-col-12">
            <div className="ph-picture"></div>
            <div className="ph-row">
              <div className="ph-col-6 big"></div>
              <div className="ph-col-4 empty big"></div>
              <div className="ph-col-2 big"></div>
              <div className="ph-col-4"></div>
              <div className="ph-col-8 empty"></div>
              <div className="ph-col-6"></div>
              <div className="ph-col-6 empty"></div>
              <div className="ph-col-12"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
