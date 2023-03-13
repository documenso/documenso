# The DocuSign Open Source Alternative.

<div>
  <img style="display: block; height: 120px; width: 24%"
    src="https://user-images.githubusercontent.com/1309312/224570645-167128ee-3e39-4578-85d2-5394d9a0379c.png">
  <img style="display: block; height: 120px; width: 24%"
    src="https://user-images.githubusercontent.com/1309312/224570651-0afd12f8-cfe3-49d1-805e-e495af963d91.png">
  <img style="display: block; height: 120px; width: 24%"
    src="https://user-images.githubusercontent.com/1309312/224570655-328d2279-058d-4a3e-b5c3-5cbd8a1f4e05.png">
  <img style="display: block; height: 120px; width: 24%"
    src="https://user-images.githubusercontent.com/1309312/224571617-1f3c2811-c1ac-4d7d-b9b0-4ab183731405.png">
  <img style="display: block; height: 120px; width: 24%"
    src="https://user-images.githubusercontent.com/1309312/224570322-b2c76ea8-7482-4043-ad97-f1221220c591.png">
  <img style="display: block; height: 120px; width: 24%"
    src="https://user-images.githubusercontent.com/1309312/224570325-a8055f24-9826-4a23-b116-4fbb0577581a.png">
  <img style="display: block; height: 120px; width: 24%"
    src="https://user-images.githubusercontent.com/1309312/224570318-f724bbd9-c394-4bdc-bace-2d78af92de44.png">
      <img style="display: block; height: 120px; width: 24%"
    src="https://user-images.githubusercontent.com/1309312/224571539-f019b860-f613-4b20-86e8-4437c5784265.png">
</div>

> **Note**
> This project is currently under community review and will publish it's first production release soon™.

## Documenso

Signing documents digitally is fast, easy and should be best practice for every document signed worldwide. This is technically quite easy today, but it also introduces a new party to every signature: The signing tool providers. While this is not a problem in itself, it should make us think about how we want these providers of trust to work. Documenso aims to be the world's most trusted document signing tool. This trust is built by empowering you to self-host Documenso and review how it works under the hood. Join us in creating the next generation of open trust infrastructure.

## Community

If you want to be part of Documenso you can:

- Check out the first source code release in this repository
- Tell us what you think in the current [Discussions](https://github.com/documenso/documenso/discussions)
- Join the [Slack Channel](https://join.slack.com/t/documenso/shared_invite/zt-1qwxxsvli-nDyojjt~wakhgBGl9JRl2w) for any questions and getting to know to other community members
- ⭐ the repository to help us raise awareness
- Fix or create [issues](https://github.com/documenso/documenso/issues), that are needed for the first production release
- Spread the word on Twitter, that Documenso is working towards a more open signing tool

## Tools

- This repos uses 📝 https://gitmoji.dev/ for more expressive commit messages.
- Use 🧹 for quality of code (eg remove comments, debug output, remove unused code)

# Tech

Documenso is built using awesome open source tech including:

- [Typescript](https://www.typescriptlang.org/)
- [Javascript (when neccessary)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [NextJS (JS Fullstack Framework)](https://nextjs.org/)
- [Postgres SQL (Database)](https://www.postgresql.org/)
- [Prisma (ORM - Object-relational mapping)](https://www.prisma.io/)
- [Tailwind CSS (Styling)](https://tailwindcss.com/)
- [Node SignPDF (Digital Signature)](https://github.com/vbuch/node-signpdf)
- [React-PDF for viewing PDFs](https://github.com/wojtekmaj/react-pdf)
- [PDF-Lib for PDF manipulation](https://github.com/Hopding/pdf-lib)
- Check out /packages.json and /apps/web/package.json for more
- Support for [opensignpdf (requires Java on server)](https://github.com/open-pdf-sign) is currently planned.

# Getting Started

## Requirements

To run Documenso locally you need

- [Node.js (Version: >=18.x)](https://nodejs.org/en/download/)
- Node Package Manger NPM - included in Node.js
- [PostgreSQL (local or remote)](https://www.postgresql.org/download/)

## Developer Setup

Follow these steps to setup documenso on you local machnine:

- Clone the repo: git clone https://github.com/documenso/documenso
- Run <code>npm i</code> in root directory
- Rename .env.example to .env
- Set DATABASE_URL value in .env file
  - You can use the provided test database url (may be wiped at any point)
  - Or setup a local postgres sql instance (recommened)
- Set SENDGRID_API_KEY value in .env file
  - You need SendGrid account, which you can create [here](https://signup.sendgrid.com/).
  - Documenso uses [Nodemailer](https://nodemailer.com/about/) so you can easily use your own smtp server
- Run <code>npm run dev</code> root directory to start
- Register a new user at http://localhost:3000/signup

---

- Optional: Create your own signing certificate
  - A demo certificate is provided in /app/web/ressources/certificate.p12
  - To generate you own using these steps and a linux Terminal or Windows Linux Subsystem see **Create your own signging certificate**.

# Creating your own signging certificate

For the digital signature of you documents you need a signign certificate in .p12 formate (public and private key). You can buy one (not recommended for dev) or use the steps to create a self-signed one:

1. Generate a private key using the OpenSSL command. You can run the following command to generate a 2048-bit RSA key:\
   <code>openssl genrsa -out private.key 2048</code>

2. Generate a self-signed certificate using the private key. You can run the following command to generate a self-signed certificate:\
   <code>openssl req -new -x509 -key private.key -out certificate.crt -days 365</code> \
   This will prompt you to enter some information, such as the Common Name (CN) for the certificate. Make sure you enter the correct information. The -days parameter sets the number of days for which the certificate is valid.
3. Combine the private key and the self-signed certificate to create the p12 certificate. You can run the following command to do this: \ <code>openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt</code>
4. You will be prompted to enter a password for the p12 file. Choose a strong password and remember it, as you will need it to use the certificate (**can be empty for dev certificates**)
5. Place the certificate <code>/apps/web/ressource/certificate.p12</code>

# Deploying - Coming Soon™

- Docker support
- One-Click-Deploy on Render.com Deploy