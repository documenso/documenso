## Documenso

# The DocuSign Open Source Alternative.

Documenso aims to be the world's most trusted document signing tool. This trust is built by empowering you to self-host Documenso and review how it works under the hood. Join us in creating the new internet of trust.

## Tools

This repos uses https://gitmoji.dev/ for more expressive commit messages.

## todos

- Sendgrid setup and nodemailer-sendgrid SMTP hint (import for interchangeability like SMTP)
- Render Deploy YAML file or similar

# Setup

- Clone the repo: git clone https://github.com/ElTimuro/documenso
- Run <code>npm i</code> in root directory
- Rename .env.example to .env
- Set DATABASE_URL and SENDGRID_API_KEY values in .env file
- Run <code>npm run dev</code> root directory to start
- Register a new user at http://localhost:3000/signup
