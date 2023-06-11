import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@documenso/prisma";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";


async function getHandler(req: NextApiRequest, res: NextApiResponse) {
    const users = await prisma.user.findMany()
    return res.status(200).send(users)
}

export default defaultHandler({
    GET: Promise.resolve({
        default: defaultResponder(getHandler)
    })
})
