import prisma from "@documenso/prisma";
import Head from "next/head";
import { ReactElement } from "react";
import Layout from "../../../components/layout";
import { NextPageWithLayout } from "../../_app";
import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import {
  ArchiveBoxIcon,
  ArrowRightCircleIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  HeartIcon,
  PencilSquareIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/20/solid";
import { classNames, NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib";
import {
  PaperAirplaneIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { getUserFromToken } from "@documenso/lib/server";
import { useRouter } from "next/router";
import { toast } from "react-hot-toast";

const RecipientsPage: NextPageWithLayout = (props: any) => {
  const router = useRouter();
  const title: string =
    `"` + props?.document?.title + `"` + "Recipients | Documenso";
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      {/* -todo add signers ui -todo add breadcrumps -todo who will sign this
      dropdown */}
      <div className="mt-10">
        <div>
          <nav className="sm:hidden" aria-label="Back">
            <a
              href="#"
              className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ChevronLeftIcon
                className="-ml-1 mr-1 h-5 w-5 flex-shrink-0 text-gray-400"
                aria-hidden="true"
              />
              Back
            </a>
          </nav>
          <nav className="hidden sm:flex" aria-label="Breadcrumb">
            <ol role="list" className="flex items-center space-x-4">
              <li>
                <div className="flex">
                  <a
                    href="/documents"
                    className="text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Documents
                  </a>
                </div>
              </li>
              <li>
                <div className="flex items-center">
                  <ChevronRightIcon
                    className="h-5 w-5 flex-shrink-0 text-gray-400"
                    aria-hidden="true"
                  />
                  <a
                    href={
                      NEXT_PUBLIC_WEBAPP_URL + "/documents/" + props.document.id
                    }
                    className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    "{props.document.title}"
                  </a>
                </div>
              </li>
              <li>
                <div className="flex items-center">
                  <ChevronRightIcon
                    className="h-5 w-5 flex-shrink-0 text-gray-400"
                    aria-hidden="true"
                  />
                  <a
                    href={
                      NEXT_PUBLIC_WEBAPP_URL +
                      "/documents/" +
                      props.document.id +
                      "/recipients"
                    }
                    aria-current="page"
                    className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Recipients
                  </a>
                </div>
              </li>
            </ol>
          </nav>
        </div>
        <div className="mt-2 md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              {props.document.title}
            </h2>
          </div>
          <div className="mt-4 flex flex-shrink-0 md:mt-0 md:ml-4">
            <button
              type="button"
              disabled={(props?.document?.Recipient?.length || 0) === 0}
              onClick={() => {
                if (
                  confirm(
                    `Send document out to ${props?.document?.Recipient?.length} recipients?`
                  )
                ) {
                  router.push("/documents/" + props.document.id);
                  toast.success("Document sent!");
                }
              }}
              className="ml-3 inline-flex items-center rounded-md border border-transparent  disabled:bg-gray-300 bg-neon px-4 py-2 text-sm font-medium text-white shadow-sm bg-grey hover:bg-neon-dark focus:outline-none focus:ring-2 focus:neon-dark focus:ring-offset-2"
            >
              <PaperAirplaneIcon className="inline text-white w-4 mr-1"></PaperAirplaneIcon>
              Send
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-md bg-white shadow mt-10 p-6">
          <div className="border-b border-gray-200 pb-5">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Signers
            </h3>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              The people who will sign the document.
            </p>
          </div>
          <ul role="list" className="divide-y divide-gray-200">
            {props?.document?.Recipient.map((item: any) => (
              <li key={item.id} className="px-0 py-4">
                <div>
                  <UserCircleIcon className="inline w-6 mr-2"></UserCircleIcon>
                  {item.email}
                  <span> (You)</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-b border-gray-200 pb-5 mt-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">CC</h3>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              Anybody who should get a copy.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

RecipientsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (!user) return;

  const { id: documentId } = context.query;
  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: +documentId,
    },
    include: {
      Recipient: true,
    },
  });

  return {
    props: {
      document: document,
    },
  };
}

export default RecipientsPage;
