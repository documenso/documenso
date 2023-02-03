import Head from "next/head";
import { ReactElement, useState } from "react";
import Layout from "../../../components/layout";
import { NextPageWithLayout } from "../../_app";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib";
import {
  PaperAirplaneIcon,
  TrashIcon,
  UserCircleIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { getUserFromToken } from "@documenso/lib/server";
import { getDocument } from "@documenso/lib/query";
import { Document as PrismaDocument } from "@prisma/client";
import { Breadcrumb, Button, IconButton } from "@documenso/ui";

const RecipientsPage: NextPageWithLayout = (props: any) => {
  const title: string =
    `"` + props?.document?.title + `"` + "Recipients | Documenso";
  const breadcrumbItems = [
    {
      title: "Documents",
      href: "/documents",
    },
    {
      title: props.document.title,
      href: NEXT_PUBLIC_WEBAPP_URL + "/documents/" + props.document.id,
    },
    {
      title: "Recipients",
      href:
        NEXT_PUBLIC_WEBAPP_URL +
        "/documents/" +
        props.document.id +
        "/recipients",
    },
  ];

  const [signers, setSigners] = useState(props?.document?.Recipient);

  if (signers.length === 0) setSigners([{ email: "", name: "" }]);

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className="mt-10">
        <div>
          <Breadcrumb document={props.document} items={breadcrumbItems} />
        </div>
        <div className="mt-2 md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              {props.document.title}
            </h2>
          </div>
          <div className="mt-4 flex flex-shrink-0 md:mt-0 md:ml-4">
            <Button
              color="primary"
              icon={PaperAirplaneIcon}
              onClick={() => {
                alert();
                // todo do stuff
              }}
              disabled={(props?.document?.Recipient?.length || 0) === 0}
            >
              Send
            </Button>
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
            {signers.map((item: any, index: number) => (
              <li
                key={index}
                className="px-0 py-4 w-full hover:bg-green-50 border-0 group"
              >
                <div id="container" className="flex w-full">
                  <div className="w-[250px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus-within:border-neon focus-within:ring-1 focus-within:ring-neon">
                    <label
                      htmlFor="name"
                      className="block text-xs font-medium text-gray-900"
                    >
                      Name
                    </label>
                    <input
                      type="email"
                      name="name"
                      value={item.name}
                      onChange={(e) => {
                        const updatedSigners = [...signers];
                        updatedSigners[index].name = e.target.value;
                        setSigners(updatedSigners);
                      }}
                      id="name"
                      className="block w-full border-0 p-0 text-gray-900 placeholder-gray-500 sm:text-sm outline-none bg-inherit"
                      placeholder="John Dorian"
                    />
                  </div>
                  <div className="ml-3 w-[250px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus-within:border-neon focus-within:ring-1 focus-within:ring-neon">
                    <label
                      htmlFor="name"
                      className="block text-xs font-medium text-gray-900"
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      name="name"
                      value={item.email}
                      onChange={(e) => {
                        const updatedSigners = [...signers];
                        updatedSigners[index].email = e.target.value;
                        setSigners(updatedSigners);
                      }}
                      id="name"
                      className="block w-full border-0 p-0 text-gray-900 placeholder-gray-500 sm:text-sm outline-none bg-inherit"
                      placeholder="john.dorian@loremipsum.com"
                    />
                  </div>
                  <div className="ml-auto flex">
                    <IconButton
                      icon={XMarkIcon}
                      disabled={!signers[0].name && !signers[0].email}
                      onClick={() => {
                        const signersWithoutIndex = [...signers];
                        signersWithoutIndex.splice(index, 1);
                        setSigners(signersWithoutIndex);
                        console.log("click");
                        // todo save to api
                      }}
                      // className="group-hover:text-neon-dark"
                    ></IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Button
            icon={UserPlusIcon}
            className="mt-3"
            onClick={() => {
              setSigners(signers.concat({ email: "", name: "" }));
            }}
          >
            Add Signer
          </Button>
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
  const document: PrismaDocument = await getDocument(
    +documentId,
    context.req,
    context.res
  );

  return {
    props: {
      document: document,
    },
  };
}

export default RecipientsPage;
