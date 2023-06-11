import toast from 'react-hot-toast'
export const getAllUsers = async (): Promise<any> => {
    try {
        const documensoUsers = await toast.promise(
            fetch('/api/admin/users').then(res => {
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