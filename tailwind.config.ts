import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe5ff",
          200: "#bccfff",
          300: "#8facff",
          400: "#5c80ff",
          500: "#3757fa",
          600: "#233beb",
          700: "#1c2dc7",
          800: "#1c2aa1",
          900: "#1d2a7f",
        },
        ig: { start: "#833AB4", mid: "#E1306C", end: "#F77737" },
        tt: { cyan: "#25F4EE", pink: "#FE2C55", dark: "#010101" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 4px 20px -4px rgb(23 42 235 / 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
