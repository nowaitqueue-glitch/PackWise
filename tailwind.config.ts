import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ["var(--font-sans)", ...fontFamily.sans],
  			mono: ["var(--font-mono)", ...fontFamily.mono],
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
			destructive: {
				DEFAULT: 'hsl(var(--destructive))',
				foreground: 'hsl(var(--destructive-foreground))'
			},
			border: 'hsl(var(--border))',
			input: 'hsl(var(--input))',
			ring: 'hsl(var(--ring))'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			"weather-bounce": {
  				"0%, 100%": { transform: "translateY(0)" },
  				"50%": { transform: "translateY(-3px)" },
  			},
  			"weather-drift": {
  				"0%, 100%": { transform: "translateX(0)" },
  				"50%": { transform: "translateX(3px)" },
  			},
  			"weather-rain": {
  				"0%": { transform: "translateY(-2px)" },
  				"100%": { transform: "translateY(2px)" },
  			},
  			"weather-fall": {
  				"0%, 100%": { transform: "translate(0, -1px)" },
  				"50%": { transform: "translate(1px, 2px)" },
  			},
  			"pulse-subtle": {
  				"0%, 100%": { opacity: "1" },
  				"50%": { opacity: "0.82" },
  			},
  		},
  		animation: {
  			"weather-bounce": "weather-bounce 2.8s ease-in-out infinite",
  			"weather-drift": "weather-drift 3.6s ease-in-out infinite",
  			"weather-rain": "weather-rain 1.1s ease-in infinite",
  			"weather-fall": "weather-fall 3.2s ease-in-out infinite",
  			"pulse-slow": "pulse-subtle 3.5s ease-in-out infinite",
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
