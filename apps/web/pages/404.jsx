import Image from "next/image";
import Link from "next/link";

import bgwood from "../public/img/bgwood.jpg";

export default function Custom404() {
  return (
    <>
      <main className="relative min-h-full isolate">
        <Image
          src={bgwood}
          alt=""
          className="absolute inset-0 object-cover object-top w-full h-full -z-10 grayscale"
        />
        <div className="px-6 py-48 mx-auto text-center max-w-7xl sm:py-40 lg:px-8">
          <p className="text-base font-semibold leading-8 text-slate-700">
            404
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Page not found
          </h1>
          <p className="mt-4 text-base text-slate-700 sm:mt-6">
            Sorry, we couldn’t find the page you’re looking for.
          </p>
          <div className="flex justify-center mt-10">
            <Link
              href="/"
              className="text-sm font-semibold leading-7 text-slate-900"
            >
              <span aria-hidden="true">&larr;</span> Back to home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
