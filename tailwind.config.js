/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["DM Sans", "sans-serif"],
        display: ["Syne", "sans-serif"],
      },
      animation: {
        "slide-up":  "slideUp 0.3s ease-out",
        "fade-in":   "fadeIn 0.2s ease-out",
        "bounce-in": "bounceIn 0.4s ease-out",
        "pulse-ring":"pulseRing 1.5s ease-out infinite",
      },
      keyframes: {
        slideUp:    { from: { transform: "translateY(100%)", opacity: 0 }, to: { transform: "translateY(0)", opacity: 1 } },
        fadeIn:     { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        bounceIn:   { "0%": { transform: "scale(0.8)", opacity: 0 }, "70%": { transform: "scale(1.05)" }, "100%": { transform: "scale(1)", opacity: 1 } },
        pulseRing:  { "0%": { transform: "scale(0.8)", opacity: 1 }, "100%": { transform: "scale(2)", opacity: 0 } },
      }
    },
  },
  plugins: [],
}