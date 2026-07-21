import { CheckCircle2, Clock, FileText } from 'lucide-react';

const RECIPIENTS = [
  { name: 'Jordan Ellis', role: 'Signer', status: 'signed' as const },
  { name: 'Melissa Barron', role: 'Signer', status: 'signed' as const },
  { name: 'Marcus Webb', role: 'Approver', status: 'pending' as const },
];

export function SigningPreviewCard() {
  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border bg-card/90 p-5 text-left shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div>
            <div className="font-semibold text-sm">Master Services Agreement</div>
            <div className="text-muted-foreground text-xs">Sent 2 minutes ago</div>
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-[11px] text-primary">In progress</span>
      </div>

      <div className="mt-4 grid gap-2">
        {RECIPIENTS.map((recipient) => (
          <div
            key={recipient.name}
            className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5"
          >
            <div>
              <div className="font-medium text-sm">{recipient.name}</div>
              <div className="text-muted-foreground text-xs">{recipient.role}</div>
            </div>
            {recipient.status === 'signed' ? (
              <span className="inline-flex items-center gap-1 font-medium text-recipient-green text-xs">
                <CheckCircle2 className="size-3.5" />
                Signed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-muted-foreground text-xs">
                <Clock className="size-3.5" />
                Awaiting
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
