import { validateApiToken } from '@documenso/lib/server-only/webhooks/zapier/validateApiToken';

export const testCredentialsHandler = async (req: Request) => {
  try {
    const authorization = req.headers.get('authorization');

    if (!authorization) {
      throw new Error('Missing authorization header');
    }

    const result = await validateApiToken({ authorization });

    return Response.json({
      name: result.team?.name ?? result.user.name,
    });
  } catch (err) {
    return Response.json(
      {
        message: 'Internal Server Error',
      },
      { status: 500 },
    );
  }
};
