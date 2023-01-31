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
import { classNames } from "@documenso/lib";
import {
  UserGroupIcon,
  UserIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

const RecipientsPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Documenttitle - Recipients | Documenso</title>
      </Head>
      -todo add signers ui -todo add breadcrumps -todo who will sign this
      dropdown
    </>
  );
};

RecipientsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export async function getServerSideProps(context: any) {
  // todo get current document
  return {
    props: {},
  };
}

export default RecipientsPage;
