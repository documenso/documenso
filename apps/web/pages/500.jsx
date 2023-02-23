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
          <p className="inline-flex items-center text-3xl font-bold sm:text-5xl">
            500
            <span className="relative px-3 font-thin sm:text-6xl -top-1.5">
              |
            </span>{" "}
            <span className="text-base font-semibold align-middle sm:text-2xl">
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
