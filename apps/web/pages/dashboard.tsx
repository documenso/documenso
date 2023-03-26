import Head from "next/head";
import { ReactElement } from "react";
import Layout from "../components/layout";
import Link from "next/link";
import type { NextPageWithLayout } from "./_app";
import {
  CheckBadgeIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { uploadDocument } from "@documenso/features";
import {
  DocumentStatus,
  SendStatus,
  SigningStatus,
  Document as PrismaDocument,
} from "@prisma/client";
import { getUserFromToken } from "@documenso/lib/server";
import { getDocumentsForUserFromToken } from "@documenso/lib/query";
import { truncate } from "fs";

type FormValues = {
  document: File;
};

const DashboardPage: NextPageWithLayout = (props: any) => {
  const stats = [
    {
      name: "Draft",
      stat: "0",
      icon: DocumentIcon,
      link: "/documents?filter=DRAFT",
    },
    {
      name: "Waiting for others",
      stat: "0",
      icon: UsersIcon,
      link: "/documents?filter=PENDING",
    },
    {
      name: "Completed",
      stat: "0",
      icon: CheckBadgeIcon,
      link: "/documents?filter=COMPLETED",
    },
  ];

  return (
    <>
      <Head>
        <title>Dashboard | Documenso</title>
      </Head>

      <div className="py-10 max-sm:px-4">
        <header>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
            Dashboard
          </h1>
        </header>
        <dl className="mt-8 grid grid-cols-3 xs:grid-cols-2 gap-5">
          {stats.map((item) => (
            <Link href={item.link} key={item.name}>
              <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 ">
                <dt className="truncate text-sm font-medium text-gray-500 ">
                  <item.icon
                    className="flex-shrink-0 mr-3 h-6 w-6 inline text-neon"
                    aria-hidden="true"
                  ></item.icon>
                  {item.name}
                </dt>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
                  {getStat(item.name, props)}
                </dd>
              </div>
            </Link>
          ))}
        </dl>
        <div className="mt-12">
          <input
            id="fileUploadHelper"
            type="file"
            accept="application/pdf"
            onChange={(event: any) => {
              uploadDocument(event);
            }}
            hidden
          />
        </div>
        <div
          onClick={() => {
            document?.getElementById("fileUploadHelper")?.click();
          }}
          className="cursor-pointer relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-neon focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 00 20 25"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>

          <span className="mt-2 block text-sm font-medium text-neon">
            Upload a new PDF document
          </span>
        </div>
      </div>
    </>
  );
};

DashboardPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

function getStat(name: string, props: any) {
  if (name === "Draft") return props.dashboard.drafts;
  if (name === "Waiting for others") return props.dashboard.waiting;
  if (name === "Completed") return props.dashboard.completed;
  return 0;
}

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (!user)
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };

  const documents: any[] = await getDocumentsForUserFromToken(context);

  const drafts: PrismaDocument[] = documents.filter(
    (d) => d.status === DocumentStatus.DRAFT
  );

  const waiting: any[] = documents.filter(
    (e) =>
      e.Recipient.length > 0 &&
      e.Recipient.some((r: any) => r.sendStatus === SendStatus.SENT) &&
      e.Recipient.some((r: any) => r.signingStatus === SigningStatus.NOT_SIGNED)
  );

  const completed: PrismaDocument[] = documents.filter(
    (d) => d.status === DocumentStatus.COMPLETED
  );

  return {
    props: {
      dashboard: {
        drafts: drafts.length,
        waiting: waiting.length,
        completed: completed.length,
      },
    },
  };
}

export default DashboardPage;
