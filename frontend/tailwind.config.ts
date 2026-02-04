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
        'custom': {'max': '1450px'},
        '3xl': '1600px',  // ecrãs ≥1600px = tamanho grande
        '4xl': '1920px',  // ecrãs muito grandes = textos ainda maiores
      },
    },
  },
  plugins: [],
};

export default config;

