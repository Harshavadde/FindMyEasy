import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17243A",
        muted: "#748198",
        canvas: "#F5F7FB",
        line: "#E5EAF1",
        brand: "#3266D5",
      },
      boxShadow: {
        card: "0 12px 32px rgba(23, 36, 58, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
