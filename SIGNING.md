# Creating your own signing certificate

For the digital signature of your documents you need a signing certificate in .p12 format (public and private key). You can buy one (not recommended for dev) or use the steps to create a self-signed one:

1. Generate a private key using the OpenSSL command. You can run the following command to generate a 2048-bit RSA key:

   `openssl genrsa -out private.key 2048`

2. Generate a self-signed certificate using the private key. You can run the following command to generate a self-signed certificate:

   `openssl req -new -x509 -key private.key -out certificate.crt -days 365`

   This will prompt you to enter some information, such as the Common Name (CN) for the certificate. Make sure you enter the correct information. The -days parameter sets the number of days for which the certificate is valid.

3. Combine the private key and the self-signed certificate to create the p12 certificate. You can run the following command to do this:

   `openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt`

4. You will be prompted to enter a password for the p12 file. Choose a strong password and remember it, as you will need it to use the certificate (**can be empty for dev certificates**)
5. Place the certificate `/apps/web/resources/certificate.p12`

## Docker

> We are still working on the publishing of docker images, in the meantime you can follow the steps below to create a production ready docker image.

Want to create a production ready docker image? Follow these steps:

- cd into `docker` directory
- Make `build.sh` executable by running `chmod +x build.sh`
- Run `./build.sh` to start building the docker image.
- Publish the image to your docker registry of choice (or) If you prefer running the image from local, run the below command

```
docker run -d --restart=unless-stopped -p 3000:3000 -v documenso:/app/data --name documenso documenso:latest
```

Command Breakdown:

- `-d` - Let's you run the container in background
- `-p` - Passes down which ports to use. First half is the host port, Second half is the app port. You can change the first half anything you want and reverse proxy to that port.
- `-v` - Volume let's you persist the data
- `--name` - Name of the container
- `documenso:latest` - Image you have built

## Deployment

We support a variety of deployment methods, and are actively working on adding more. Stay tuned for updates!

## Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/DjrRRX)

## Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/documenso/documenso)
