import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@documenso/ui";
import Logo from "./logo";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

export default function ResetPassword(props: any) {
  const router = useRouter();
  const { token } = router.query;

  const methods = useForm<ResetPasswordForm>();
  const { register, formState, watch } = methods;
  const password = watch("password", "");

  const [resetSuccessful, setResetSuccessful] = useState(false);

  const onSubmit = async (values: ResetPasswordForm) => {
    const response = await toast.promise(
      fetch(`/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: values.password, token }),
      }),
      {
        loading: "Resetting...",
        success: `Reset password successful`,
        error: "Could not reset password :/",
      }
    );

    if (!response.ok) {
      toast.dismiss();
      const error = await response.json();
      toast.error(error.message);
    }

    if (response.ok) {
      setResetSuccessful(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
  };

  return (
    <>
      <div className="flex min-h-full items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Logo className="mx-auto h-20 w-auto"></Logo>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Reset Password
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {resetSuccessful ? "Your password has been reset." : "Please chose your new password"}
            </p>
          </div>
          {resetSuccessful ? null : (
            <FormProvider {...methods}>
              <form className="mt-8 space-y-6" onSubmit={methods.handleSubmit(onSubmit)}>
                <div className="-space-y-px rounded-md shadow-sm">
                  <div>
                    <label htmlFor="password" className="sr-only">
                      Password
                    </label>
                    <input
                      {...register("password", { required: "Password is required" })}
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="focus:border-neon focus:ring-neon relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm"
                      placeholder="New password"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="sr-only">
                      Password
                    </label>
                    <input
                      {...register("confirmPassword", {
                        required: "Please confirm password",
                        validate: (value) => value === password || "The passwords do not match",
                      })}
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      className="focus:border-neon focus:ring-neon relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm"
                      placeholder="Confirm new password"
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
            </FormProvider>
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
