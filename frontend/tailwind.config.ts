import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '375px',    // telemóveis maiores
        'custom': {'max': '1450px'},
        '3xl': '1600px',
        '4xl': '1920px',
      },
    },
  },
  plugins: [],
};

export default config;

