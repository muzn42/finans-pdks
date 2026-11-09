import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"]
      },
      colors: {
        albayrak: {
          red: "#E31E24",
          redDark: "#B9151B",
          charcoal: "#1C1D1F",
          slate: "#2B2D30"
        }
      },
      transitionTimingFunction: {
        "spring-out": "cubic-bezier(0.23, 1, 0.32, 1)",
        "drawer": "cubic-bezier(0.32, 0.72, 0, 1)"
      }
    }
  },
  plugins: []
};

export default config;
