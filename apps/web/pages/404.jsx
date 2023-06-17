import { Button } from "@documenso/ui";
import Logo from "../components/logo";
import { ArrowSmallLeftIcon } from "@heroicons/react/20/solid";
import Link from "next/link";

export default function Custom404() {
  return (
    <>
      <main className="relative isolate min-h-full bg-gray-100">
        <Link href="/" className="absolute top-10 left-10 flex gap-x-2 items-center">
          <Logo className="w-10 text-black" />
          <h2 className="text-2xl font-semibold">Documenso</h2>
        </Link>

        <div className="mx-auto max-w-7xl px-6 py-48 text-center sm:py-40 lg:px-8">
          <p className="text-brown text-base font-semibold leading-8">404</p>
          <h1 className="text-brown mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Page not found
          </h1>
          <p className="mt-4 text-base text-gray-700 sm:mt-6">
            Sorry, we couldn’t find the page you’re looking for.
          </p>
          <div className="mt-10 flex justify-center">
            <Button
              color="secondary"
              href="/"
              icon={ArrowSmallLeftIcon}
              className="text-brown text-base font-semibold leading-7">
              Back to home
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
