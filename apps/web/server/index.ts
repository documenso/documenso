import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';

const hostname = process.env.HOST || '[::]';
const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  }).listen(port);

  // eslint-disable-next-line no-console
  console.log(
    `> Server listening at http://${hostname}:${port} as ${dev ? 'development' : process.env.NODE_ENV
    }`
  );
});
