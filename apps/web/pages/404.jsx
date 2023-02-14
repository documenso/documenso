import { ArrowSmallLeftIcon } from "@heroicons/react/20/solid";

import { Button } from "@documenso/ui";
import Logo from "../components/logo";

export default function Custom404() {
  return (
    <>
      <main className="relative min-h-full bg-gray-200 isolate">
        <Logo className="absolute w-20 top-10 left-10" />

        <div className="px-6 py-48 mx-auto text-center max-w-7xl sm:py-40 lg:px-8">
          <p className="text-base font-semibold leading-8 text-brown">
            404
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-brown sm:text-5xl font-monteserrat">
            Page not found
          </h1>
          <p className="mt-4 text-base text-gray-700 sm:mt-6">
            Sorry, we couldn’t find the page you’re looking for.
          </p>
          <div className="flex justify-center mt-10">
            <Button
              color="secondary"
              href="/"
              className="text-base font-semibold leading-7 text-brown font-monteserrat"
            >
              <ArrowSmallLeftIcon className="w-5 h-5 mr-2" /> Back to home
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
