import { Fragment, useEffect, useState } from "react";
import { classNames, localStorage } from "@documenso/lib";
import { Button } from "@documenso/ui";
import { Dialog, Transition } from "@headlessui/react";

export default function NameDialog(props: any) {
  const [name, setName] = useState(props.defaultName);

  useEffect(() => {
    const nameFromStorage = localStorage.getItem("typedName");

    if (nameFromStorage) {
      setName(nameFromStorage);
    }
  }, []);

  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-10"
        onClose={() => {
          props.setOpen(false);
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
              <Dialog.Panel className="relative min-h-[350px] transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                <div>
                  <h4 className="text-center text-2xl font-medium">
                    Enter your name in the input below!
                  </h4>

                  <div className="my-3 border-b border-gray-300">
                    <input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                      }}
                      className={classNames(
                        "focus:border-neon focus:ring-neon mt-14 block h-10 w-full text-center align-bottom font-sans text-2xl leading-none"
                      )}
                      placeholder="Kindly type your name"
                    />
                  </div>

                  <div className="float-right">
                    <Button
                      color="secondary"
                      onClick={() => {
                        props.onClose();
                        props.setOpen(false);
                      }}>
                      Cancel
                    </Button>
                    <Button
                      className="ml-3"
                      disabled={!name}
                      onClick={() => {
                        localStorage.setItem("typedName", name);
                        props.onClose({
                          type: "type",
                          typedSignature: name,
                        });
                      }}>
                      Sign
                    </Button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
