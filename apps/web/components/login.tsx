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
            <Logo className="mx-auto h-10 w-auto"></Logo>
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
                  <a href="#" className="hover:text-neon-700 font-medium text-gray-500">
                    Forgot your password?
                  </a>
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
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-gray-100 px-2 text-gray-500">Or continue with</span>
                  </div>
                </div>

                <Button
                  color="secondary"
                  disabled={formState.isSubmitting}
                  onClick={() =>
                    signIn("google", { callbackUrl: `${NEXT_PUBLIC_WEBAPP_URL}/dashboard` })
                  }
                  className="group relative mt-2 flex w-full ">
                  <span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 186.69 190.5">
                      <g transform="translate(1184.583 765.171)">
                        <path
                          clipPath="none"
                          mask="none"
                          d="M-1089.333-687.239v36.888h51.262c-2.251 11.863-9.006 21.908-19.137 28.662l30.913 23.986c18.011-16.625 28.402-41.044 28.402-70.052 0-6.754-.606-13.249-1.732-19.483z"
                          fill="#4285f4"
                        />
                        <path
                          clipPath="none"
                          mask="none"
                          d="M-1142.714-651.791l-6.972 5.337-24.679 19.223h0c15.673 31.086 47.796 52.561 85.03 52.561 25.717 0 47.278-8.486 63.038-23.033l-30.913-23.986c-8.486 5.715-19.31 9.179-32.125 9.179-24.765 0-45.806-16.712-53.34-39.226z"
                          fill="#34a853"
                        />
                        <path
                          clipPath="none"
                          mask="none"
                          d="M-1174.365-712.61c-6.494 12.815-10.217 27.276-10.217 42.689s3.723 29.874 10.217 42.689c0 .086 31.693-24.592 31.693-24.592-1.905-5.715-3.031-11.776-3.031-18.098s1.126-12.383 3.031-18.098z"
                          fill="#fbbc05"
                        />
                        <path
                          d="M-1089.333-727.244c14.028 0 26.497 4.849 36.455 14.201l27.276-27.276c-16.539-15.413-38.013-24.852-63.731-24.852-37.234 0-69.359 21.388-85.032 52.561l31.692 24.592c7.533-22.514 28.575-39.226 53.34-39.226z"
                          fill="#ea4335"
                          clipPath="none"
                          mask="none"
                        />
                      </g>
                    </svg>
                  </span>
                  Sign In with Google
                </Button>
              </div>
            </form>
          </FormProvider>

          {/* Sign UP */}
          <div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center"></div>
            </div>
          </div>
          {props.allowSignup ? (
            <p className="pt-2 text-center text-sm text-gray-600">
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
              <Link href="https://documenso.com" className="text-neon hover:text-neon font-medium">
                Hosted Documenso will be availible soon™
              </Link>
            </p>
          )}
        </div>
      </div>
      {/* <Toaster position="top-center" /> */}
    </>
  );
}
