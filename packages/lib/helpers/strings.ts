/**
 * Truncates a title to a given max length substituting the middle with an ellipsis.
 */
export const truncate = (str: string, maxLength: number = 20) => {
    if (str.length <= maxLength) {
        return str;
    }
    
    const startLength = Math.ceil((maxLength - 3) / 2);
    const endLength = Math.floor((maxLength - 3) / 2);
    
    return `${str.slice(0, startLength)}...${str.slice(-endLength)}`;
};
