import { Fragment, useEffect } from "react";
import { updateUserDetails } from "@documenso/lib/api/admin/";
import { Button } from "@documenso/ui";
import { Dialog, Transition } from "@headlessui/react";
import { FormProvider, useForm } from "react-hook-form";

type User = {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean | null;
  isAdmin: boolean;
  Document?: Document[];
};
type Document = {
  document: string;
  id: number;
  title: string;
  status: string;
};
type Props = {
  setShowPopup: (val: boolean) => void;
  showPopup: boolean;
  userDetails: User;
  setUserDetails: (val: User) => void;
};
interface UserValues {
  id: number;
  name: string;
  email: string;
  emailVerified: string;
  isAdmin: boolean;
}
const UserDetailPopup = (props: Props) => {
  const { userDetails } = props;
  const methods = useForm<UserValues>({
    defaultValues: userDetails,
  });
  const {
    register,
    formState,
    reset,
    formState: { isDirty },
  } = methods;

  useEffect(() => {
    reset(userDetails);
  }, [reset, userDetails]);
  const onSubmit = async (values: UserValues) => {
    try {
      const updatedData = await updateUserDetails(values);
      props.setUserDetails(updatedData);
    } catch (err) { }
  };
  return (
    <Transition.Root show={props.showPopup} as={Fragment}>
      <Dialog
        as="div"
        className=" relative"
        onClose={() => {
          props.setShowPopup(false);
        }}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left font-mono shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="flex justify-start">
                  <Dialog.Title className="text-xl font-bold">
                    Details of {userDetails?.name}
                  </Dialog.Title>
                </div>
                <FormProvider {...methods}>
                  <form className="mt-8 space-y-2" onSubmit={methods.handleSubmit(onSubmit)}>
                    <label htmlFor="email-address" className="font-semibold">
                      Name
                    </label>
                    <input
                      {...register("name")}
                      id="email-address"
                      defaultValue={userDetails?.name}
                      className="focus:border-neon focus:ring-neon relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm"
                    />
                    <label className="font-semibold">Email</label>
                    <input
                      {...register("email")}
                      defaultValue={userDetails?.email}
                      className="focus:border-neon focus:ring-neon relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm"
                    />
                    <div>
                      <input
                        type="checkbox"
                        id="admin_check"
                        {...register("isAdmin")}
                        className="hidden"
                      />
                      <label htmlFor="admin_check" className="font-semibold">
                        isAdmin
                        <span className="mb-4 flex h-10 w-28 cursor-pointer rounded bg-white p-2 shadow">
                          <span
                            className={`block h-full w-1/2 transform rounded transition duration-300 ease-in-out ${methods.getValues().isAdmin
                              ? "translate-x-full bg-green-500"
                              : "bg-red-500"
                              }`}></span>
                        </span>
                      </label>
                    </div>
                    {userDetails?.Document?.length > 0 && (
                      <div>
                        <span className="font-semibold flex flex-col">
                          Documents
                          {userDetails?.Document && userDetails?.Document?.map((document: Document) => (
                            <div className='flex items-center justify-between' key={document.id}>
                              <span className='font-normal'>{document.title}</span>
                              <span className='bg-green-300 p-1 rounded-lg font-normal lowercase'>{document.status}</span>

                            </div>
                          ))}
                        </span>
                      </div>
                    )}

                    <div className="m-1 flex justify-end">
                      <Button type="submit" disabled={!isDirty}>
                        Save
                      </Button>
                    </div>
                  </form>
                </FormProvider>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};
export default UserDetailPopup;
