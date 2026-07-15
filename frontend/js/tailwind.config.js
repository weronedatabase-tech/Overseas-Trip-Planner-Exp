// [CONSIDERATION - UI/UX]: Overriding default colors to ensure a pure black/zinc dark mode.
// We explicitly remove blue-tinted slates/grays for OLED optimization.
tailwind.config = { 
  darkMode: 'class', 
  theme: { 
    extend: { 
      colors: { 
        primary: '#2563eb',
        gray: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#000000', // Pure black for extreme dark mode backgrounds
        }
      } 
    } 
  } 
};