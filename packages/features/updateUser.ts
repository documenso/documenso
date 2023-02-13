import toast from "react-hot-toast";

export const updateUser = async (user: any) => {
  if (!user) return;
  toast.promise(
    fetch("/api/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    }),
    {
      loading: "Saving Changes...",
      success: `Saved!`,
      error: "Changes could not save user :/",
    }
  );
};
