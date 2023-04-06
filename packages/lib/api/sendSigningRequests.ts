import toast from "react-hot-toast";

export const sendSigningRequests = async (document: any, resendTo: number[] = []) => {
  if (!document || !document.id) return;
  try {
    const sent = await toast.promise(
      fetch(`/api/documents/${document.id}/send`, {
        body: JSON.stringify({ resendTo: resendTo }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
        .then((res: any) => {
          if (!res.ok) {
            throw new Error(res.status.toString());
          }
        })
        .finally(() => {
          location.reload();
        }),
      {
        loading: "Sending...",
        success: `Sent!`,
        error: "Could not send :/",
      }
    );
  } catch (err) {
    console.log(err);
  }
};
