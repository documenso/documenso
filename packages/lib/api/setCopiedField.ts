export const setCopiedField = async (recipient: any) => {
  if (!recipient || !recipient.id) return;
  try {
    fetch(`/api/documents/${recipient.id}/copied`, {
      headers: { "Content-Type": "application/json" },
      method: "GET",
    })
      .then((res: any) => {
        console.log("documenso/lib/api/setCopiedField", res);

        if (!res.ok) {
          throw new Error(res.status.toString());
        }
      })
      .finally(() => {
        location.reload();
      });
  } catch (err) {
    console.log(err);
  }
};
