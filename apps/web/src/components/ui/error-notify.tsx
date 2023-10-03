import { Dispatch, SetStateAction } from 'react';

export type ErrorNotifyProps = {
  errorMessage: string | null;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
};

export const ErrorNotify = ({ errorMessage, setErrorMessage }: ErrorNotifyProps) => {
  return (
    <div
      id="alert-2"
      className="mb-4 flex items-center rounded-lg bg-red-50 p-4 text-red-800 dark:bg-gray-800 dark:text-red-400"
      role="alert"
    >
      <svg
        className="h-4 w-4 flex-shrink-0"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
      </svg>
      <span className="sr-only">Info</span>
      <div className="ml-3 text-sm font-medium">{errorMessage}</div>
      <button
        type="button"
        className="-mx-1.5 -my-1.5 ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-200 focus:ring-2 focus:ring-red-400 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700"
        data-dismiss-target="#alert-2"
        aria-label="Close"
        onClick={() => setErrorMessage(null)}
      >
        <span className="sr-only">Close</span>
        <svg
          className="h-3 w-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 14 14"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
          />
        </svg>
      </button>
    </div>
  );
};

{
  /* <div className="mt-2 rounded-md bg-red-500 p-2 text-white relative">
<button
  
  className="absolute top-1 right-1 text-white font-semibold cursor-pointer"
>
  ×
</button>
<div className="text-center">{errorMessage}</div>
</div> */
}
