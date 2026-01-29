import type { LoaderFunctionArgs } from "@remix-run/node";
import { EnvelopeType } from "@prisma/client";
import { prisma } from "@documenso/prisma";
import { AppError } from "@documenso/lib/errors/app-error";
import { getFileServerSide } from "@documenso/lib/universal/upload/get-file.server";
import { getUserByApiToken } from "@documenso/lib/server-only/public-api/get-user-by-token";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const { id } = params;
    if (!id) throw new AppError("Missing Template ID", { statusCode: 400 });

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      throw new AppError("Missing API Token", { statusCode: 401 });
    }

    // Use the correct helper which handles token hashing
    const user = await getUserByApiToken({ token }).catch(() => null);

    if (!user) {
      throw new AppError("Invalid API Token", { statusCode: 401 });
    }

    const template = await prisma.envelope.findFirst({
      where: {
        id,
        userId: user.id,
        type: EnvelopeType.TEMPLATE,
      },
      select: {
        title: true,
        envelopeItems: {
          take: 1,
          orderBy: { order: "asc" },
          include: { documentData: true },
        },
      },
    });

    if (!template) {
      throw new AppError("Template not found", { statusCode: 404 });
    }

    const firstItem = template.envelopeItems[0];
    if (!firstItem || !firstItem.documentData) {
      throw new AppError("Document data missing", { statusCode: 404 });
    }

    const file = await getFileServerSide({
      type: firstItem.documentData.type,
      data: firstItem.documentData.data,
    });

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${template.title}.pdf"`,
      },
    });

  } catch (err) {
    // LINT FIX: We catch 'err' as unknown, then cast it to a specific type
    // This satisfies the "no-explicit-any" rule
    const error = err as Error & { statusCode?: number; status?: number; code?: string };

    console.error("Template download failed:", error);

    return new Response(JSON.stringify({
      error: error.message || "Unknown error",
      code: error.code || "INTERNAL_ERROR",
    }), {
      status: error.statusCode || error.status || 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};