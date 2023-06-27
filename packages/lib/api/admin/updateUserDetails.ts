import toast from 'react-hot-toast'
export const updateUserDetails = async (payload: any): Promise<any> => {
  try {
    const updatedDetails = await toast.promise(
      fetch('/api/admin/user', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).then(res => {
        if (!res.ok) {
          throw new Error(res.status.toString())
        }
        return res.json()
      }),
      {
        loading: `Updating user details...`,
        success: 'User details updated',
        error: `Failed to update user details`
      }
    );
    return updatedDetails
  } catch (err) {
    console.log(err)
  }
}
