import { LockClosedIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Logo from "./logo";
import { getCsrfToken, signIn } from "next-auth/react";
import { ErrorCode } from "@documenso/lib/auth";
import { useState } from "react";
import { useRouter } from "next/router";

interface LoginValues {
  email: string;
  password: string;
  totpCode: string;
  csrfToken: string;
}

export default function Login() {
  const router = useRouter();
  const methods = useForm<LoginValues>();
  const { register, formState } = methods;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  let callbackUrl =
    typeof router.query?.callbackUrl === "string"
      ? router.query.callbackUrl
      : "";

  // If not absolute URL, make it absolute
  if (!/^https?:\/\//.test(callbackUrl)) {
    callbackUrl = `http://localhost:3000/${callbackUrl}`;
  }

  const onSubmit = async (values: LoginValues) => {
    setErrorMessage(null);
    const res = await signIn<"credentials">("credentials", {
      ...values,
      callbackUrl,
      redirect: false,
    });
    if (!res) setErrorMessage("error");
    // we're logged in! let's do a hard refresh to the desired url
    else if (!res.error) router.push(callbackUrl);
    // fallback if error not found
    else setErrorMessage("something_went_wrong");
  };

  return (
    <>
      <div className="flex min-h-full items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Logo className="mx-auto h-10 w-auto her"></Logo>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Sign in to your account
            </h2>
          </div>
          <FormProvider {...methods}>
            <form
              className="mt-8 space-y-6"
              onSubmit={methods.handleSubmit(onSubmit)}
            >
              <input type="hidden" name="remember" defaultValue="true" />
              <div className="-space-y-px rounded-md shadow-sm">
                <div>
                  <label htmlFor="email-address" className="sr-only">
                    Email
                  </label>
                  <input
                    {...register("email")}
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    {...register("password")}
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="Password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <a href="#" className="font-medium text-neon hover:text-neon">
                    Forgot your password?
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={formState.isSubmitting}
                  className="group relative flex w-full justify-center rounded-md border border-transparent bg-neon py-2 px-4 text-sm font-medium text-white hover:bg-neon-dark focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <LockClosedIcon
                      className="h-5 w-5 text-neon-dark group-hover:text-neon"
                      aria-hidden="true"
                    />
                  </span>
                  Sign in
                </button>
              </div>
              <p className="mt-2 text-center text-sm text-gray-600">
                Are you new here?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-neon hover:text-neon"
                >
                  Create a new Account
                </Link>
              </p>
            </form>
          </FormProvider>
        </div>
      </div>
    </>
  );
}
