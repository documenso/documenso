import * as React from "react";
import { Container } from "@react-email/components";

interface Props {
  publicUrl: string;
}

export function Logo(props: Props) {
  const { publicUrl } = props;
  return (
    <Container className="text-center">
      <img src={`${publicUrl}/logo_h.png`} className="h-6 w-44" alt="Documenso Logo" />
    </Container>
  );
}
