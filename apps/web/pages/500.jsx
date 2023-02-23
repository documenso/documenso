import Logo from "../components/logo";
import { Button } from "@documenso/ui";
import { ArrowSmallLeftIcon } from "@heroicons/react/20/solid";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";

export default function Custom500() {
  return (
    <>
      <div className="relative flex flex-col items-center justify-center min-h-full text-white bg-black">
        <div className="absolute top-10 left-10">
          <Logo dark className="w-10 md:w-20" />
        </div>

        <div className="px-4 py-10 mt-20 max-w-7xl">
          
            <p className="inline text-3xl font-bold tracking-tight sm:text-5xl">
              500
              <span className="px-3 font-thin">|</span>{" "}
              <span className="inline text-base font-semibold leading-8 align-middle sm:text-2xl">
                Something went wrong.
              </span>
            </p>
          

          <div className="flex justify-center mt-10">
            <Button color="secondary" href="/" icon={ArrowSmallLeftIcon}>
              Back to home
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
