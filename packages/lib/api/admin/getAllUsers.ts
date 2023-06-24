import toast from 'react-hot-toast'
export const getAllUsers = async (entries: number): Promise<any> => {
    try {
        const documensoUsers = await toast.promise(
            fetch(`/api/admin/users?page=1&limit=${entries}`).then(res => {
                if (!res.ok) {
                    throw new Error(res.status.toString())
                }
                return res.json()
            }),
            {
                loading: "Getting all users",
                success: "Users updated.",
                error: "Failed to get users"
            }
        );
        return documensoUsers
    } catch (err) {
    }
}