import { NextApiRequest, NextApiResponse } from 'next'
import prisma from '@documenso/prisma'
import { defaultHandler, defaultResponder } from '@documenso/lib/server'


async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  let id = +req.query.id ?? 0;
  const userDetails = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      isAdmin: true
    }
  })
  if (!userDetails) {
    return res.status(400).end(`Couldnt find user for id:${id} `)
  }

}
