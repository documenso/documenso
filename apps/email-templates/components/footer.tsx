import * as React from "react";
import { Hr, Link, Section } from "@react-email/components";

export function Footer() {
  return (
    <Section className="text-[#666666]">
      <div>
        <b>Do not forward.</b>
        <br />
        This email gives access to a secure document. Keep it secret and do not forward this email.
      </div>

      <div className="mt-4">
        <b>Need help?</b>
        <br />
        Contact us at <Link href="mailto:hi@documenso.com">hi@documenso.com</Link>
      </div>

      <div>
        <Hr className="border-[#D8D8D8]" />
      </div>
      <div className="text-center">
        <small>Easy and beautiful document signing by Documenso.</small>
      </div>
    </Section>
  );
}
