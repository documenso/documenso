// const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // sans: ['Monteserrat', 'sans-serif'],
        monteserrat: ["Monteserrat", "sans-serif"],
      },
      colors: {
        neon: "#37f095",
        brown: "#353434",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      maxWidth: {
        "2xl": "40rem",
      },
    },
  },
};
