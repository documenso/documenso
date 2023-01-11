import { Fragment, useEffect } from "react";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navigation from "./navigation";

import {
  Bars3Icon,
  BellIcon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import Logo from "./logo";
import { signOut, useSession } from "next-auth/react";

const user = {
  name: "Timur Ercan",
  email: "timur@documenso.com",
  imageUrl:
    "https://pbs.twimg.com/profile_images/1382036502390181888/4BT30oTM_400x400.jpg",
};
const navigation = [
  { name: "Dashboard", href: "/dashboard", current: false },
  { name: "Documents", href: "/documents", current: false },
  { name: "Settings", href: "/settings", current: true },
];
const userNavigation = [
  { name: "Your Profile", href: "/settings/profile", icon: UserCircleIcon },
  {
    name: "Sign out",
    href: "",
    click: (e: any) => {
      e.preventDefault();
      signOut({ callbackUrl: "/login" });
    },
    icon: ArrowLeftOnRectangleIcon,
  },
];

function classNames(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

function useRedirectToLoginIfUnauthenticated() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace({
        pathname: "/login",
        query: {
          callbackUrl: `http://localhost:3000${location.pathname}${location.search}`,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  return {
    loading: loading && !session,
    session,
  };
}

export default function Layout({ children }: any) {
  useRedirectToLoginIfUnauthenticated();
  const router = useRouter();
  navigation.forEach((element) => {
    element.current = router.route.startsWith("/" + element.href.split("/")[1]);
  });

  const { status } = useSession();

  return (
    <>
      <div className="min-h-full">
        <Navigation></Navigation>
        <main>
          <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </>
  );
}
