import * as React from "react";
import { Footer } from "./footer";
import { Logo } from "./logo";
import { Body, Container, Head, Html, Preview, Tailwind } from "@react-email/components";

export const BaseLayout = ({
  children,
  message,
}: {
  children: React.ReactNode;
  message: string;
}) => {
  return (
    <Html>
      <Head />
      <Preview>{message}</Preview>
      <Tailwind>
        <Body className="my-auto mx-auto bg-[#eaeaea] p-12 font-sans">
          <Logo />
          <Container className="text-center">
            <p className="my-2 text-[#bdc1c6]">{message}</p>
          </Container>
          <div className="my-4">{children}</div>
          <Footer />
        </Body>
      </Tailwind>
    </Html>
  );
};
