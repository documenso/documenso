import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { Button } from "@documenso/ui";
import Logo from "./logo";
import { LockClosedIcon } from "@heroicons/react/20/solid";
import { signIn } from "next-auth/react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

interface LoginValues {
  email: string;
  password: string;
  totpCode: string;
  csrfToken: string;
}

export default function Login(props: any) {
  const router = useRouter();
  const methods = useForm<LoginValues>();
  const { register, formState } = methods;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  let callbackUrl = typeof router.query?.callbackUrl === "string" ? router.query.callbackUrl : "";

  // If not absolute URL, make it absolute
  if (!/^https?:\/\//.test(callbackUrl)) {
    callbackUrl = `${NEXT_PUBLIC_WEBAPP_URL}/${callbackUrl}`;
  }

  const onSubmit = async (values: LoginValues) => {
    setErrorMessage(null);
    const res = await toast.promise(
      signIn<"credentials">("credentials", {
        ...values,
        callbackUrl,
        redirect: false,
      }),
      {
        loading: "Logging in...",
        success: "Login successful.",
        error: "Could not log in :/",
      },
      {
        style: {
          minWidth: "200px",
        },
      }
    );
    if (!res) {
      setErrorMessage("Error");
      toast.dismiss();
      toast.error("Something went wrong.");
    } else if (!res.error) {
      // we're logged in, let's do a hard refresh to the original url
      router.push(callbackUrl);
    } else {
      toast.dismiss();
      if (res.status == 401) {
        toast.error("Invalid email or password.");
      } else {
        toast.error("Could not login.");
      }
    }
  };

  return (
    <>
      <div className="flex min-h-full items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Logo className="mx-auto h-20 w-auto text-black"></Logo>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Sign in to your account
            </h2>
          </div>
          <FormProvider {...methods}>
            <form className="mt-8 space-y-6" onSubmit={methods.handleSubmit(onSubmit)}>
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
                    className="focus:border-neon focus:ring-neon relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm"
                    placeholder="Email"
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
                    className="focus:border-neon focus:ring-neon relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm"
                    placeholder="Password"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <Link
                    href="/forgot-password"
                    className="hover:text-neon-700 font-medium text-gray-500">
                    Forgot your password?
                  </Link>
                </div>
              </div>
              <div>
                <Button
                  type="submit"
                  disabled={formState.isSubmitting}
                  className="group relative flex w-full">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <LockClosedIcon
                      className="text-neon-700 group-hover:text-neon-dark-700 h-5 w-5 duration-200 disabled:disabled:bg-gray-600 disabled:group-hover:bg-gray-600"
                      aria-hidden="true"
                    />
                  </span>
                  Sign in
                </Button>
              </div>
              <div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center"></div>
                </div>
              </div>
              {props.allowSignup ? (
                <p className="mt-2 text-center text-sm text-gray-600">
                  Are you new here?{" "}
                  <Link
                    href="/signup"
                    className="hover:text-neon-700 font-medium text-gray-500 duration-200">
                    Create a new Account
                  </Link>
                </p>
              ) : (
                <p className="mt-2 text-center text-sm text-gray-600">
                  Like Documenso{" "}
                  <Link
                    href="https://documenso.com"
                    className="text-neon hover:text-neon font-medium">
                    Hosted Documenso is here!
                  </Link>
                </p>
              )}
            </form>
          </FormProvider>
        </div>
      </div>
      {/* <Toaster position="top-center" /> */}
    </>
  );
}
