import { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type SigningVolume = {
  customer_id: number;
  customer_type: 'User' | 'Team';
  customer_created_at: Date;
  total_documents: bigint;
  completed_documents: bigint;
  customer_email: string;
  customer_name: string;
};

export type GetSigningVolumeOptions = {
  search?: string;
  page?: number;
  perPage?: number;
};

export const getSigningVolume = async ({
  search = '',
  page = 1,
  perPage = 10,
}: GetSigningVolumeOptions = {}): Promise<{
  signingVolume: SigningVolume[];
  totalPages: number;
}> => {
  const offset = (page - 1) * perPage;

  const whereClause = search
    ? `AND (LOWER(COALESCE(u.name, t.name)) LIKE $1 OR LOWER(COALESCE(u.email, te.email)) LIKE $1)`
    : '';

  const searchParam = search ? [`%${search.toLowerCase()}%`] : [];

  const [results, totalCount] = await prisma.$transaction(async (tx) => {
    const signingVolumeQuery = tx.$queryRaw<SigningVolume[]>`
      WITH paying_customers AS (
        SELECT DISTINCT
          COALESCE(s."userId", t."ownerUserId") AS customer_id,
          CASE
            WHEN s."userId" IS NOT NULL THEN 'User'
            ELSE 'Team'
          END AS customer_type,
          COALESCE(s."createdAt", t."createdAt") AS customer_created_at
        FROM "Subscription" s
        FULL OUTER JOIN "Team" t ON s."teamId" = t.id
        WHERE s.status = 'ACTIVE'
      ),
      document_counts AS (
        SELECT
          COALESCE(d."userId", t."ownerUserId") AS customer_id,
          COUNT(DISTINCT d.id) AS total_documents,
          COUNT(DISTINCT CASE WHEN d.status = 'COMPLETED' THEN d.id END) AS completed_documents
        FROM "Document" d
        LEFT JOIN "Team" t ON d."teamId" = t.id
        GROUP BY COALESCE(d."userId", t."ownerUserId")
      )
      SELECT
        pc.customer_id,
        pc.customer_type,
        pc.customer_created_at,
        COALESCE(dc.total_documents, 0) AS total_documents,
        COALESCE(dc.completed_documents, 0) AS completed_documents,
        CASE
          WHEN pc.customer_type = 'User' THEN u.email
          ELSE te.email
        END AS customer_email,
        CASE
          WHEN pc.customer_type = 'User' THEN u.name
          ELSE t.name
        END AS customer_name
      FROM paying_customers pc
      LEFT JOIN document_counts dc ON pc.customer_id = dc.customer_id
      LEFT JOIN "User" u ON pc.customer_id = u.id AND pc.customer_type = 'User'
      LEFT JOIN "Team" t ON pc.customer_id = t."ownerUserId" AND pc.customer_type = 'Team'
      LEFT JOIN "TeamEmail" te ON t.id = te."teamId"
      WHERE 1=1 ${Prisma.raw(whereClause)}
      ORDER BY dc.completed_documents DESC NULLS LAST, pc.customer_created_at DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;

    const totalCountQuery = tx.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM (
        WITH paying_customers AS (
          SELECT DISTINCT
            COALESCE(s."userId", t."ownerUserId") AS customer_id,
            CASE
              WHEN s."userId" IS NOT NULL THEN 'User'
              ELSE 'Team'
            END AS customer_type,
            COALESCE(s."createdAt", t."createdAt") AS customer_created_at
          FROM "Subscription" s
          FULL OUTER JOIN "Team" t ON s."teamId" = t.id
          WHERE s.status = 'ACTIVE'
        )
        SELECT
          pc.customer_id,
          CASE
            WHEN pc.customer_type = 'User' THEN u.email
            ELSE te.email
          END AS customer_email,
          CASE
            WHEN pc.customer_type = 'User' THEN u.name
            ELSE t.name
          END AS customer_name
        FROM paying_customers pc
        LEFT JOIN "User" u ON pc.customer_id = u.id AND pc.customer_type = 'User'
        LEFT JOIN "Team" t ON pc.customer_id = t."ownerUserId" AND pc.customer_type = 'Team'
        LEFT JOIN "TeamEmail" te ON t.id = te."teamId"
        WHERE 1=1 ${Prisma.raw(whereClause)}
      ) subquery
    `;

    const [signingVolumeResults, totalCountResults] = await Promise.all([
      signingVolumeQuery,
      totalCountQuery,
    ]);

    return [signingVolumeResults, totalCountResults];
  });

  const totalPages = Math.ceil(Number(totalCount[0].count) / perPage);

  return { signingVolume: results, totalPages };
};
