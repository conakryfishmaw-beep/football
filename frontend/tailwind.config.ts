import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          900: "#05120a",
          800: "#0b2016",
          700: "#103225",
          500: "#1f8a56",
          300: "#6dd1a1",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
