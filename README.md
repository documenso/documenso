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

## Documenso
Signing documents digitally is fast, easy and should be best practice for every document signed worldwide. This is technically quite easy today, but it also introduces a new party to every signature: The signing tool providers. While this is not a problem in itself, it should make us think about how we want these providers of trust to work. Documenso aims to be the world's most trusted document signing tool. This trust is built by empowering you to self-host Documenso and review how it works under the hood. Join us in creating the next generation of open trust infrastructure.

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
