import { Mails } from 'lucide-react';

import { SendConfirmationEmailForm } from '~/components/forms/send-confirmation-email';

export default function UnverifiedAccount() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <Mails className="text-primary h-10 w-10" strokeWidth={2} />
        </div>
        <div className="">
          <h2 className="text-2xl font-bold md:text-4xl">ელ. ფოსტის დაადასტურება</h2>

          <p className="text-muted-foreground mt-4">
            თქვენს ანგარიშზე წვდომის მისაღებად, გთხოვთ გადახვიდეთ თქვენ ელ. ფოსტაზე გამოგზავნილ
            დადასტურების ბმულზე.
          </p>

          <p className="text-muted-foreground mt-4">
            თუ თქვენ ვერ იპოვით დადასტურების ბმულს, შეგიძლიათ მოითხოვოთ ახალი ქვემოთ.
          </p>

          <SendConfirmationEmailForm />
        </div>
      </div>
    </div>
  );
}
