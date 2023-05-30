import { ChangeEvent, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { updateUser } from "@documenso/features";
import { getUser } from "@documenso/lib/api";
import { fetchPortalSession, isSubscriptionsEnabled, useSubscription } from "@documenso/lib/stripe";
import { Button } from "@documenso/ui";
import { BillingPlans } from "./billing-plans";
import { CreditCardIcon, KeyIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { SubscriptionStatus } from "@prisma/client";
import { useSession } from "next-auth/react";

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

if (process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS === "true") {
  subNavigation.push({
    name: "Billing",
    href: "/settings/billing",
    icon: CreditCardIcon,
    current: false,
  });
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

export default function Setttings() {
  const session = useSession();
  const { subscription, hasSubscription } = useSubscription();
  const [user, setUser] = useState({
    email: "",
    name: "",
  });
  useEffect(() => {
    getUser().then((res: any) => {
      res.json().then((j: any) => {
        setUser(j);
      });
    });
  }, [session]);

  const router = useRouter();
  subNavigation.forEach((element) => {
    element.current = element.href == router.route;
  });

  const [savingTimeout, setSavingTimeout] = useState<any>();
  const [password, setPassword] = useState("");
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
          <h1 className="text-brown text-3xl font-bold leading-tight tracking-tight">Settings</h1>
        </div>
      </header>
      <div
        className="mx-auto max-w-screen-xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-16"
        hidden={!user.email}>
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
                        ? "border-neon-dark bg-teal-50 text-teal-700 hover:bg-teal-50 hover:text-teal-700"
                        : "border-transparent text-gray-900 hover:bg-gray-50 hover:text-gray-900",
                      "group flex items-center border-l-4 px-3 py-2 text-sm font-medium"
                    )}
                    aria-current={item.current ? "page" : undefined}>
                    <item.icon
                      className={classNames(
                        item.current
                          ? "text-teal-500 group-hover:text-teal-500"
                          : "text-gray-400 group-hover:text-gray-500",
                        "-ml-1 mr-3 h-6 w-6 flex-shrink-0"
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </aside>

            <form
              className="min-h-[251px] divide-y divide-gray-200 lg:col-span-9"
              action="#"
              method="POST"
              hidden={subNavigation.filter((e) => e.current)[0]?.name !== subNavigation[0].name}>
              {/* Profile section */}
              <div className="py-6 px-4 sm:p-6 lg:pb-8">
                <div>
                  <h2 className="text-lg font-medium leading-6 text-gray-900">Profile</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Let people know who they are dealing with builds trust.
                  </p>
                </div>

                <div className="my-6 grid grid-cols-12 gap-6">
                  <div className="col-span-12 sm:col-span-6">
                    <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
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
                      className="focus:border-neon focus:ring-neon mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:outline-none sm:text-sm"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6">
                    <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      disabled
                      value={user?.email!}
                      type="text"
                      name="first-name"
                      id="first-name"
                      autoComplete="given-name"
                      className="focus:border-neon focus:ring-neon mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:outline-none disabled:bg-neutral-100 sm:text-sm"
                    />
                  </div>
                </div>
                <Button onClick={() => updateUser(user)}>Save</Button>
              </div>
            </form>

            <div
              hidden={subNavigation.filter((e) => e.current)[0]?.name !== subNavigation[1].name}
              className="min-h-[251px] divide-y divide-gray-200 lg:col-span-9">
              {/* Passwords section */}
              <div className="py-6 px-4 sm:p-6 lg:pb-8">
                <div>
                  <h2 className="text-lg font-medium leading-6 text-gray-900">Update Password</h2>

                  <div className="my-6 grid grid-cols-12 gap-6">
                    <div className="col-span-12 sm:col-span-6">
                      <label
                        htmlFor="first-name"
                        className="block text-sm font-medium text-gray-700">
                        New Password
                      </label>

                      <input
                        type="password"
                        name="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="focus:border-neon focus:ring-neon mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:outline-none sm:text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    disabled={password.length < 6}
                    onClick={() => updateUser({ ...user, password })}>
                    Save
                  </Button>
                </div>
              </div>
            </div>

            <div
              hidden={
                !subNavigation.at(2) ||
                subNavigation.find((e) => e.current)?.name !== subNavigation.at(2)?.name
              }
              className="min-h-[251px] divide-y divide-gray-200 lg:col-span-9">
              {/* Billing section */}
              <div className="py-6 px-4 sm:p-6 lg:pb-8">
                <div>
                  <h2 className="text-lg font-medium leading-6 text-gray-900">Billing</h2>

                  {!isSubscriptionsEnabled() && (
                    <p className="mt-2 text-sm text-gray-500">
                      Subscriptions are not enabled on this instance, you have nothing to do here.
                    </p>
                  )}

                  {isSubscriptionsEnabled() && (
                    <>
                      <p className="mt-1 text-sm text-gray-500">
                        Your subscription is currently{" "}
                        <strong>
                          {subscription?.status &&
                          subscription?.status !== SubscriptionStatus.INACTIVE
                            ? "Active"
                            : "Inactive"}
                        </strong>
                        .
                      </p>

                      {subscription?.status === SubscriptionStatus.PAST_DUE && (
                        <p className="mt-1 text-sm text-red-500">
                          Your subscription is past due. Please update your payment details to
                          continue using the service without interruption.
                        </p>
                      )}

                      <div className="mt-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                          <BillingPlans />
                        </div>

                        {subscription && (
                          <Button
                            onClick={() => {
                              if (isSubscriptionsEnabled() && subscription?.customerId) {
                                fetchPortalSession({
                                  id: subscription.customerId,
                                }).then((res) => {
                                  if (res.success) {
                                    window.location.href = res.url;
                                  }
                                });
                              }
                            }}>
                            Manage my subscription
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
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
