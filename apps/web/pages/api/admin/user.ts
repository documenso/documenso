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
  return res.status(200).send(userDetails)

}
async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const userDetails = req.body;
  const updatedUser = await prisma.user.update({
    where: { id: userDetails.id },
    data: {
      name: userDetails.name,
      email: userDetails.email,
      emailVerified: userDetails.emailVerified,
      isAdmin: userDetails.isAdmin
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      isAdmin: true
    }
  })
  if (!updatedUser) {
    return res.status(400).send(`Couldnt update user details`)
  }
  return res.status(200).send(updatedUser)
}

export default defaultHandler({
  GET: Promise.resolve({
    default: defaultResponder(getHandler)
  }),
  POST: Promise.resolve({
    default: defaultResponder(postHandler)
  })
})
