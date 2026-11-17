import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // 로고 색 기반 팔레트 (logo.png: #1e96d2 / #197fc3). 사이트 메인 색은 brand, 보조 색은 Tailwind 기본 amber(노랑).
            colors: {
                brand: {
                    50: '#eff8fd', 100: '#dbeffa', 200: '#bfe3f5', 300: '#93d0ee', 400: '#5bb6e2',
                    500: '#1e96d2', 600: '#197fc3', 700: '#16669e', 800: '#165683', 900: '#17486c', 950: '#0f2e47',
                },
            },
            fontFamily: {
                sans: ['Pretendard', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif'],
            },
            keyframes: {
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                fadeInUp: 'fadeInUp 0.6s ease-out forwards',
                // modalFadeIn / slideDown 애니메이션은 src/index.css 에 정의 (.animate-modalFadeIn, .animate-slideDown)
            }
        },
    },
    plugins: [
        forms,
    ],
}
