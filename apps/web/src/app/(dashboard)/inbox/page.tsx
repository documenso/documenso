import Inbox from '~/components/(dashboard)/inbox/inbox';

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="text-4xl font-semibold">Inbox</h1>
      <h3>Documents which you have been requested to sign.</h3>

      <div className="mt-8">
        <Inbox className="4xl:h-[70vh] sm:h-[40rem]" />
      </div>
    </div>
  );
}
