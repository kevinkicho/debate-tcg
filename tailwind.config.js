module.exports = {
  theme: {
    extend: {
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-10px)' },
          '75%': { transform: 'translateX(10px)' },
        }
      },
      animation: {
        shake: 'shake 0.2s ease-in-out infinite',
      }
    }
  }
}