import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dildey palette — warm sunset theme; light text over the imagery
        canvas: "#F7F5F2",   // light fallback (rarely seen now)
        primary: "#4A7C6F",  // forest green
        secondary: "#8B6F5C",// warm taupe
        accent: "#D4956A",   // amber
        ink: "#F4F1EA",      // primary text — warm near-white (on dark imagery)
        muted: "#C7CBC4",    // secondary text — soft light
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 2px 16px rgba(43, 51, 48, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
