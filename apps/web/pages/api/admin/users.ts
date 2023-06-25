import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@documenso/prisma";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";


async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  let { page, limit } = req.query
  page = parseInt(page)
  limit = parseInt(limit)
  const usersCount = await prisma.user.count()
  const totalPages = Math.ceil(usersCount / limit)

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, emailVerified: true, isAdmin: true },
    take: limit,
    skip: (page - 1) * limit
  })
  if (!users) {
    return res.status(400).end('Users werent found')
  }
  const paginatedResult = {
    totalPages,
    users,
    page
  }
  return res.status(200).send(paginatedResult)
}

export default defaultHandler({
  GET: Promise.resolve({
    default: defaultResponder(getHandler)
  })
})
