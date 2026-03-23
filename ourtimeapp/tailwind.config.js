/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Game Mode (Partner B)
        game: {
          primary: '#FFB800',
          success: '#00D26A',
          streak: '#FF6B35',
          trophy: '#8B5CF6',
          danger: '#EF4444',
        },
        // Gift Mode (Partner A)
        gift: {
          primary: '#FDF6E3',
          accent: '#E8B4B8',
          text: '#4A4A4A',
          success: '#A8C686',
        },
        // Shared
        heart: '#FF6B6B',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      maxWidth: {
        mobile: '430px',
      },
      animation: {
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
        'float-up': 'float-up 1s ease-out forwards',
        'bounce-in': 'bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
        },
        'float-up': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        'bounce-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 107, 107, 0.4)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 10px rgba(255, 107, 107, 0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 107, 107, 0)' },
        },
      },
    },
  },
  plugins: [],
}
