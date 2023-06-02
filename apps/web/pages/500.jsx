import Link from "next/link";
import { Button } from "@documenso/ui";
import Logo from "../components/logo";
import { ArrowSmallLeftIcon } from "@heroicons/react/20/solid";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";

export default function Custom500() {
  return (
    <>
      <div className="relative flex min-h-full flex-col items-center justify-center bg-black text-white">
        <Link href="/" className="absolute top-10 left-10 flex items-center gap-x-2 invert">
          <Logo className="w-10 text-black" />
          <h2 className="text-2xl font-semibold text-black">Documenso</h2>
        </Link>

        <div className="mt-20 max-w-7xl px-4 py-10">
          <p className="inline-flex items-center text-3xl font-bold sm:text-5xl">
            500
            <span className="relative -top-1.5 px-3 font-thin sm:text-6xl">|</span>{" "}
            <span className="align-middle text-base font-semibold sm:text-2xl">
              Something went wrong.
            </span>
          </p>
          <div className="mt-10 flex justify-center">
            <Button color="secondary" href="/" icon={ArrowSmallLeftIcon}>
              Back to home
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
