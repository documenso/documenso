import { useState } from "react";
import Link from "next/link";
import { Button } from "@documenso/ui";
import Logo from "./logo";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPassword() {
  const { register, formState, resetField, handleSubmit } = useForm<ForgotPasswordForm>();
  const [resetSuccessful, setResetSuccessful] = useState(false);

  const onSubmit = async (values: ForgotPasswordForm) => {
    const response = await toast.promise(
      fetch(`/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      }),
      {
        loading: "Sending...",
        success: "Reset link sent.",
        error: "Could not send reset link :/",
      }
    );

    if (!response.ok) {
      toast.dismiss();

      if (response.status == 404) {
        toast.error("Email address not found.");
      }

      if (response.status == 400) {
        toast.error("Password reset requested.");
      }

      if (response.status == 500) {
        toast.error("Something went wrong.");
      }

      return;
    }

    if (response.ok) {
      setResetSuccessful(true);
    }

    resetField("email");
  };

  return (
    <>
      <div className="flex min-h-full items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Logo className="mx-auto h-20 w-auto"></Logo>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              {resetSuccessful ? "Reset Password" : "Forgot Password?"}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {resetSuccessful
                ? "Please check your email for reset instructions."
                : "No worries, we'll send you reset instructions."}
            </p>
          </div>
          {!resetSuccessful && (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
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
                    className="focus:border-neon focus:ring-neon relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm"
                    placeholder="Email"
                  />
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={formState.isSubmitting}
                  className="group relative flex w-full">
                  Reset password
                </Button>
              </div>
            </form>
          )}
          <div>
            <Link href="/login">
              <div className="relative mt-10 flex items-center justify-center gap-2 text-sm text-gray-500 hover:cursor-pointer hover:text-gray-900">
                <ArrowLeftIcon className="h-4 w-4" />
                Back to log in
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
