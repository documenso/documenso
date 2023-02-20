export const localStorage = {
  getItem(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      // In case storage is restricted. Possible reasons
      // 1.  Chrome/Firefox/... Incognito mode.
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // In case storage is restricted. Possible reasons
      // 1.  Chrome/Firefox/... Incognito mode.
      // 2. Storage limit reached
      return;
    }
  },
};
