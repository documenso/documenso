## Documenso

# The DocuSign Open Source Alternative.

Signing documents digitally is fast, easy and should be best practice for every document signed worldwide. This is technically quite easy today, but it also introduces a new party to every signing transaction, the signing tool providers. While this is not a problem in itself, it should make us think about how we want these providers of trust to work. Documenso aims to be the world's most trusted document signing tool. This trust is built by empowering you to self-host Documenso and review how it works under the hood. Join us in creating the next generation of open trust infrastructure.

## Tools

- This repos uses 📝 https://gitmoji.dev/ for more expressive commit messages.
- Use 🧹 for quality of code (eg remove comments, debug output, remove unused code) 

## Todos

- Sendgrid setup and nodemailer-sendgrid SMTP hint (import for interchangeability like SMTP)
- Render Deploy YAML file or similar
- Create self signed cert step by step with recommendation for use and validity scope

# Setup

- Clone the repo: git clone https://github.com/ElTimuro/documenso
- Run <code>npm i</code> in root directory
- Rename .env.example to .env
- Set DATABASE_URL and SENDGRID_API_KEY values in .env file
- Run <code>npm run dev</code> root directory to start
- Register a new user at http://localhost:3000/signup
