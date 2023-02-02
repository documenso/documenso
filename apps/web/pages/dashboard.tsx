import Head from "next/head";
import { ReactElement } from "react";
import Layout from "../components/layout";
import Link from "next/link";
import type { NextPageWithLayout } from "./_app";
import {
  BellSnoozeIcon,
  CheckBadgeIcon,
  EnvelopeIcon,
  EyeIcon,
  SunIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { uploadDocument } from "@documenso/features";
import prisma from "@documenso/prisma";
import {
  ReadStatus,
  SendStatus,
  DocumentStatus,
  Document as PrismaDocument,
} from "@prisma/client";
import { getUserFromToken } from "@documenso/lib/server";
import { getDocumentsForUserFromToken } from "@documenso/lib/query";

type FormValues = {
  document: File;
};

const DashboardPage: NextPageWithLayout = (props: any) => {
  const stats = [
    {
      name: "Draft",
      stat: "0",
      icon: SunIcon,
      link: "/documents?filter=",
    },
    {
      name: "Sent",
      stat: "0",
      icon: EnvelopeIcon,
      link: "/documents?filter=",
    },
    {
      name: "Viewed",
      stat: "0",
      icon: EyeIcon,
      link: "/documents?filter=",
    },
    {
      name: "Signed",
      stat: "0",
      icon: CheckBadgeIcon,
      link: "/documents?filter=",
    },
    {
      name: "Expired",
      stat: "0",
      icon: BellSnoozeIcon,
      link: "/documents?filter=",
    },
    {
      name: "Declined",
      stat: "0",
      icon: XCircleIcon,
      link: "/documents?filter=",
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
        <dl className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {stats.map((item) => (
            <Link href={item.link} key={item.name}>
              <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
                <dt className="truncate text-sm font-medium text-gray-500">
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
          className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-neon focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 00 20 25"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
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

// todo layout as component
DashboardPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

function getStat(name: string, props: any) {
  if (name === "Draft") return props.dashboard.drafts;
  if (name === "Sent") return props.dashboard.sent;
  if (name === "Viewed") return props.dashboard.viewed;
  if (name === "Signed") return props.dashboard.signed;
  return 0;
}

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (!user) return;

  // todo optimize querys
  // todo no intersection groups

  const documents: PrismaDocument[] = await getDocumentsForUserFromToken(
    context
  );

  const drafts: PrismaDocument[] = documents.filter(
    (d) => d.status === DocumentStatus.DRAFT
  );

  const completed: PrismaDocument[] = documents.filter(
    (d) => d.status === DocumentStatus.COMPLETED
  );

  const sent = await prisma.recipient.groupBy({
    by: ["documentId"],
    where: {
      sendStatus: SendStatus.SENT,
      readStatus: ReadStatus.NOT_OPENED,
    },
  });

  const opened = await prisma.recipient.groupBy({
    by: ["documentId"],
    where: {
      sendStatus: SendStatus.SENT,
      readStatus: ReadStatus.OPENED,
    },
  });

  return {
    props: {
      dashboard: {
        drafts: drafts.length,
        sent: sent.length,
        viewed: opened.length,
        signed: completed.length,
      },
    },
  };
}

export default DashboardPage;
