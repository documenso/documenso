import Logo from "../components/logo";
import { Button } from "@documenso/ui";
import { ArrowSmallLeftIcon } from "@heroicons/react/20/solid";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";

export default function Custom500() {
  return (
    <>
      <div className="relative flex items-center justify-center min-h-full text-white bg-black isolate">
        <div className="absolute top-10 left-10">
          <Logo dark className="w-10 md:w-20" />
        </div>

        <div className="px-6 py-48 mx-auto text-center max-w-7xl sm:py-40 lg:px-8">
          <h1 className="inline text-3xl font-bold tracking-tight sm:text-5xl">
            500
            <span className="px-3 font-thin">
           |
            </span>
          </h1>
          <p className="inline text-base font-semibold leading-8 sm:text-2xl">
            
            Something went wrong.
          </p>
          <div className="flex justify-center mt-10">
            <Button
              color="secondary"
              href="/"
              icon={ArrowSmallLeftIcon}
              className="text-base font-semibold leading-7 text-brown"
            >
              Back to home
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
