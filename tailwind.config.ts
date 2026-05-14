import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0e14",
          surface: "#0f1419",
          elevated: "#151b23",
          border: "#1f2630",
        },
        ink: {
          DEFAULT: "#e5e9f0",
          muted: "#8a94a6",
          subtle: "#5a6677",
        },
        edge: {
          DEFAULT: "#7cf5b6",
          muted: "#4dd498",
          glow: "#7cf5b633",
        },
        bull: "#22c55e",
        bear: "#ef4444",
        warn: "#f59e0b",
        info: "#3b82f6",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
