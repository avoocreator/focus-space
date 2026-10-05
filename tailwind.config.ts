import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./stores/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "var(--cream)",
        warmwhite: "var(--warm-white)",
        peach: "var(--peach)",
        peachdark: "var(--peach-dark)",
        accent: "var(--accent)",
        accentdeep: "var(--accent-deep)",
        brown: "var(--brown)",
        brownlight: "var(--brown-light)",
        tan: "var(--tan)",
        green: "var(--green)",
        greendark: "var(--green-dark)",
        blue: "var(--blue)",
        bluedark: "var(--blue-dark)",
        pink: "var(--pink)",
        yellow: "var(--yellow)",
        yellowdark: "var(--yellow-dark)",
        red: "var(--red)",
        reddark: "var(--red-dark)",
        card: "var(--card-bg)",
        cardline: "var(--card-border)",
        main: "var(--text-main)",
        muted: "var(--text-muted)",
      },
      fontFamily: {
        head: ["var(--font-head)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
      },
      boxShadow: {
        "hard-sm": "2px 2px 0 var(--card-border)",
        "hard-md": "4px 4px 0 var(--card-border)",
        "hard-lg": "6px 6px 0 var(--card-border)",
        "hard-xl": "8px 8px 0 var(--card-border)",
      },
      keyframes: {
        popIn: {
          "0%": { transform: "scale(0.92)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-10px) rotate(5deg)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
        bouncy: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        blobFloat: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-20px) scale(1.07)" },
        },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        eqBounce: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        pulseDot: {
          "0%": { boxShadow: "0 0 0 0 rgba(126,200,160,0.7)" },
          "70%": { boxShadow: "0 0 0 5px rgba(126,200,160,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(126,200,160,0)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-6px)" },
          "40%, 80%": { transform: "translateX(6px)" },
        },
        confettiFall: {
          "0%": { transform: "translateY(-10vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(110vh) rotate(720deg)", opacity: "0" },
        },
      },
      animation: {
        popIn: "popIn 0.25s both",
        slideUp: "slideUp 0.3s both",
        slideDown: "slideDown 0.25s both",
        floaty: "floaty 6s ease-in-out infinite",
        wiggle: "wiggle 4s ease-in-out infinite",
        bouncy: "bouncy 2s infinite",
        blobFloat: "blobFloat 8s ease-in-out infinite",
        fadeIn: "fadeIn 0.25s both",
        eqBounce: "eqBounce 0.9s ease-in-out infinite",
        pulseDot: "pulseDot 2s infinite",
        shake: "shake 0.4s ease-in-out",
      },
    },
  },
  plugins: [],
};
export default config;
