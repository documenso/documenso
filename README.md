# Davinci Sign

Professional electronic signature solution by Davinci AI Solutions.

> **Note:** This project is based on [Documenso](https://github.com/documenso/documenso), an open-source document signing platform. We extend our gratitude to the Documenso team for their excellent work.

## About Davinci Sign

Davinci Sign provides a fast, secure, and easy document signing experience for businesses. Built on the robust Documenso platform, it offers:

- Secure electronic signatures
- Self-hosting capability
- Full control over your document signing infrastructure
- Integration with your existing workflows

## Tech Stack

<p align="left">
  <a href="https://www.typescriptlang.org"><img src="https://shields.io/badge/TypeScript-3178C6?logo=TypeScript&logoColor=FFF&style=flat-square" alt="TypeScript"></a>
  <a href="https://prisma.io"><img width="122" height="20" src="http://made-with.prisma.io/indigo.svg" alt="Made with Prisma" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/tailwindcss-0F172A?&logo=tailwindcss" alt="Tailwind CSS"></a>
  <a href=""><img src="" alt=""></a>
  <a href=""><img src="" alt=""></a>
  <a href=""><img src="" alt=""></a>
  <a href=""><img src="" alt=""></a>
  <a href=""><img src="" alt=""></a>
</p>

- [Typescript](https://www.typescriptlang.org/) - Language
- [ReactRouter](https://reactrouter.com/) - Framework
- [Prisma](https://www.prisma.io/) - ORM
- [Tailwind](https://tailwindcss.com/) - CSS
- [shadcn/ui](https://ui.shadcn.com/) - Component Library
- [react-email](https://react.email/) - Email Templates
- [tRPC](https://trpc.io/) - API
- [@documenso/pdf-sign](https://www.npmjs.com/package/@documenso/pdf-sign) - PDF Signatures (launching soon)
- [React-PDF](https://github.com/wojtekmaj/react-pdf) - Viewing PDFs
- [PDF-Lib](https://github.com/Hopding/pdf-lib) - PDF manipulation
- [Stripe](https://stripe.com/) - Payments

<!-- - Support for [opensignpdf (requires Java on server)](https://github.com/open-pdf-sign) is currently planned. -->

## Local Development

### Requirements

To run Davinci Sign locally, you will need

- Node.js (v22 or above)
- Postgres SQL Database
- Docker (optional)

### Developer Quickstart

> **Note**: This is a quickstart for developers. It assumes that you have both [docker](https://docs.docker.com/get-docker/) and [docker-compose](https://docs.docker.com/compose/) installed on your machine.

Want to get up and running quickly? Follow these steps:

1. [Fork this repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-forks) to your GitHub account.

After forking the repository, clone it to your local device by using the following command:

```sh
git clone https://github.com/<your-username>/documenso
```

2. Set up your `.env` file using the recommendations in the `.env.example` file. Alternatively, just run `cp .env.example .env` to get started with our handpicked defaults.

3. Run `npm run dx` in the root directory

   - This will spin up a postgres database and inbucket mailserver in a docker container.

4. Run `npm run dev` in the root directory

5. Want it even faster? Just use

```sh
npm run d
```

#### Access Points for Your Application

1. **App** - http://localhost:3000
2. **Incoming Mail Access** - http://localhost:9000
3. **Database Connection Details**

   - **Port**: 54320
   - **Connection**: Use your favorite database client to connect using the provided port.

4. **S3 Storage Dashboard** - http://localhost:9001

## Developer Setup

### Manual Setup

Follow these steps to setup Davinci Sign on your local machine:

1. [Fork this repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-forks) to your GitHub account.

After forking the repository, clone it to your local device by using the following command:

```sh
git clone https://github.com/<your-username>/documenso
```

2. Run `npm i` in the root directory

3. Create your `.env` from the `.env.example`. You can use `cp .env.example .env` to get started with our handpicked defaults.

4. Set the following environment variables:

   - NEXTAUTH_SECRET
   - NEXT_PUBLIC_WEBAPP_URL
   - NEXT_PRIVATE_DATABASE_URL
   - NEXT_PRIVATE_DIRECT_DATABASE_URL
   - NEXT_PRIVATE_SMTP_FROM_NAME
   - NEXT_PRIVATE_SMTP_FROM_ADDRESS

5. Create the database schema by running `npm run prisma:migrate-dev`

6. Run `npm run translate:compile` in the root directory to compile lingui

7. Run `npm run dev` in the root directory to start

8. Register a new user at http://localhost:3000/signup

---

- Optional: Seed the database using `npm run prisma:seed -w @documenso/prisma` to create a test user and document.
- Optional: Create your own signing certificate.
  - To generate your own using these steps and a Linux Terminal or Windows Subsystem for Linux (WSL), see **[Create your own signing certificate](./SIGNING.md)**.
- Optional: Configure job provider for document reminders.
  - The default local job provider does not support scheduled jobs required for document reminders.
  - To enable reminders, set `NEXT_PRIVATE_JOBS_PROVIDER=inngest` and provide `NEXT_PRIVATE_INNGEST_EVENT_KEY` in your `.env` file.

### Run in Gitpod

- Click below to launch a ready-to-use Gitpod workspace in your browser.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/documenso/documenso)

### Run in DevContainer

We support DevContainers for VSCode. [Click here to get started.](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/documenso/documenso)

### Video walkthrough

If you're a visual learner and prefer to watch a video walkthrough of setting up Documenso locally, check out this video:

[![Watch the video](https://img.youtube.com/vi/Y0ppIQrEnZs/hqdefault.jpg)](https://youtu.be/Y0ppIQrEnZs)

## Docker

Docker containers are available for running Davinci Sign. The original Documenso images are published on both DockerHub and GitHub Container Registry.

- DockerHub: [https://hub.docker.com/r/documenso/documenso](https://hub.docker.com/r/documenso/documenso)
- GitHub Container Registry: [https://ghcr.io/documenso/documenso](https://ghcr.io/documenso/documenso)

You can pull the Docker image from either of these registries and run it with your preferred container hosting provider.

Please note that you will need to provide environment variables for connecting to the database, mailserver, and so forth.

For detailed instructions on how to configure and run the Docker container, please refer to the [Docker README](./docker/README.md) in the `docker` directory.

## Self Hosting

We support a variety of deployment methods, and are actively working on adding more. Stay tuned for updates!

### Fetch, configure, and build

First, clone the code from Github:

```
git clone https://github.com/documenso/documenso.git
```

Then, inside the `documenso` folder, copy the example env file:

```
cp .env.example .env
```

The following environment variables must be set:

- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_WEBAPP_URL`
- `NEXT_PRIVATE_DATABASE_URL`
- `NEXT_PRIVATE_DIRECT_DATABASE_URL`
- `NEXT_PRIVATE_SMTP_FROM_NAME`
- `NEXT_PRIVATE_SMTP_FROM_ADDRESS`

> If you are using a reverse proxy in front of Documenso, don't forget to provide the public URL for the `NEXT_PUBLIC_WEBAPP_URL` variable!

Now you can install the dependencies and build it:

```
npm i
npm run build
npm run prisma:migrate-deploy
```

Finally, you can start it with:

```
cd apps/remix
npm run start
```

This will start the server on `localhost:3000`. For now, any reverse proxy can then do the frontend and SSL termination.

> If you want to run with another port than 3000, you can start the application with `next -p <ANY PORT>` from the `apps/remix` folder.

### Run as a service

You can use a systemd service file to run the app. Here is a simple example of the service running on port 3500 (using 3000 by default):

```bash
[Unit]
Description=documenso
After=network.target

[Service]
Environment=PATH=/path/to/your/node/binaries
Type=simple
User=www-data
WorkingDirectory=/var/www/documenso/apps/remix
ExecStart=/usr/bin/next start -p 3500
TimeoutSec=15
Restart=always

[Install]
WantedBy=multi-user.target
```

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/bG6D4p)

### Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/documenso/documenso)

### Koyeb

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?type=git&repository=github.com/documenso/documenso&branch=main&name=documenso-app&builder=dockerfile&dockerfile=/docker/Dockerfile)

## Elestio

[![Deploy on Elestio](https://elest.io/images/logos/deploy-to-elestio-btn.png)](https://elest.io/open-source/documenso)

## Troubleshooting

### I'm not receiving any emails when using the developer quickstart.

When using the developer quickstart, an [Inbucket](https://inbucket.org/) server will be spun up in a docker container that will store all outgoing emails locally for you to view.

The Web UI can be found at http://localhost:9000, while the SMTP port will be on localhost:2500.

### Support IPv6

If you are deploying to a cluster that uses only IPv6, you can use a custom command to pass a parameter to the Remix start command

For local docker run

```bash
docker run -it documenso:latest npm run start -- -H ::
```

For k8s or docker-compose

```yaml
containers:
  - name: documenso
    image: documenso:latest
    imagePullPolicy: IfNotPresent
    command:
      - npm
    args:
      - run
      - start
      - --
      - -H
      - '::'
```

### I can't see environment variables in my package scripts.

Wrap your package script with the `with:env` script like such:

```
npm run with:env -- npm run myscript
```

The same can be done when using `npx` for one of the bin scripts:

```
npm run with:env -- npx myscript
```

This will load environment variables from your `.env` and `.env.local` files.

## Repo Activity

![Repository Activity](https://repobeats.axiom.co/api/embed/622a2e9aa709696f7226304b5b7178a5741b3868.svg)
