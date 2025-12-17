export default {
  index: {
    type: 'page',
    title: 'Home',
    display: 'hidden',
    theme: {
      timestamp: false,
    },
  },
  users: {
    type: 'page',
    title: 'Users',
  },
  developers: {
    type: 'page',
    title: 'Developers',
  },
  updates: {
    title: "What's New",
    type: 'menu',
    items: {
      changelog: {
        title: 'Changelog',
        href: 'https://documenso.com/changelog',
        newWindow: true,
      },
      blog: {
        title: 'Blog',
        href: 'https://documenso.com/blog',
        newWindow: true,
      },
    },
  },
};
