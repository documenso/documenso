/**
 * Apply the public statistics API's wildcard CORS policy, without credentials.
 */
export default async function cors(req: Request, res: Response): Promise<Response> {
  const { headers } = res;
  headers.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    headers.set('Vary', 'Access-Control-Request-Headers');

    const allowedHeaders = req.headers.get('Access-Control-Request-Headers');

    if (allowedHeaders) {
      headers.set('Access-Control-Allow-Headers', allowedHeaders);
    }

    headers.set('Content-Length', '0');
    return new Response(null, { status: 204, headers });
  }

  return res;
}
