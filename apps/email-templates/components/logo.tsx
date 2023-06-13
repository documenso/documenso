import * as React from "react";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib";
import { Container } from "@react-email/components";

export function Logo() {
  return (
    <Container className="text-center">
      <img src={`${NEXT_PUBLIC_WEBAPP_URL}/logo_h.png`} className="h-6 w-44" alt="Documenso Logo" />
    </Container>
  );
}
