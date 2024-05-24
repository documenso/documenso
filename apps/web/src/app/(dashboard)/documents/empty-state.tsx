import { Bird, CheckCircle2 } from 'lucide-react';
import { match } from 'ts-pattern';

import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

export type EmptyDocumentProps = { status: ExtendedDocumentStatus };

export const EmptyDocumentState = ({ status }: EmptyDocumentProps) => {
  const {
    title,
    message,
    icon: Icon,
  } = match(status)
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      title: 'ხელმოსაწერი არაფერია',
      message:
        'ხელმოწერილი დოკუმენტები ჯერ არ არის. თქვენ მიერ შექმნილი ან მიღებული დოკუმენტები ხელმოწერის შემდეგ აქ გამოჩნდება.',
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      title: 'აქტიური დრაფტები არ არის',
      message:
        'ამ დროისთვის აქტიური დრაფტები არ არის. შედგენის დასაწყებად შეგიძლიათ ატვირთოთ დოკუმენტი.',
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.ALL, () => ({
      title: '',
      message:
        'თქვენ ჯერ არ შეგიქმნიათ ან არ მიგიღიათ დოკუმენტი. დოკუმენტის შესაქმნელად გთხოვთ ატვირთოთ ფაილი.',
      icon: Bird,
    }))
    .otherwise(() => ({
      title: 'ხელმოსაწერი არაფერია',
      // title: 'nothing to do',
      message:
        'ყველა დოკუმენტი დამუშავებულია. ნებისმიერი ახალი დოკუმენტი, რომელიც მიიღება, აქ გამოჩნდება.',
      icon: CheckCircle2,
    }));

  return (
    <div
      className="text-muted-foreground/60 flex h-60 flex-col items-center justify-center gap-y-4"
      data-testid="empty-document-state"
    >
      <Icon className="h-12 w-12" strokeWidth={1.5} />

      <div className="text-center">
        <h3 className="text-lg font-semibold">{title}</h3>

        <p className="mt-2 max-w-[60ch]">{message}</p>
      </div>
    </div>
  );
};
