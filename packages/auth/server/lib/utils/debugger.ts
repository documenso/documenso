export const authDebugger = (message: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG]: ${message}`);
  }
};
