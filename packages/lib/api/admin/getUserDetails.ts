import toast from 'react-hot-toast'
export const getUserDetails = async (id: number): Promise<any> => {
  try {
    const userDetails = await toast.promise(
      fetch(`/api/admin/user?id=${id}`).then(res => {
        if (!res.ok) {
          throw new Error(res.status.toString())
        }
        return res.json()
      }),
      {
        loading: `Getting user details of id:${id}`,
        success: 'User details downloaded',
        error: 'Failed to get user details'
      }
    );
    return userDetails
  } catch (err) {
    console.log(err)
  }
}
