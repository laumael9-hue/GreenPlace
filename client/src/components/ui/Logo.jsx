import { useId } from 'react';

// GreenPlace mark: a location pin ("place") holding a leaf ("green").
export function LogoMark({ className = 'w-9 h-9' }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${gradientId})`} />
      <path
        d="M24 8c-6.6 0-11.8 5.1-11.8 11.5 0 8.4 9.2 16.7 11.1 18.4.4.4 1 .4 1.4 0 1.9-1.7 11.1-10 11.1-18.4C35.8 13.1 30.6 8 24 8z"
        fill="#fff"
      />
      <path d="M17.6 25.2c0-5.4 3.9-8.7 11.4-9.4.5 7-3.1 11.8-9.1 11.8-1.4 0-2.3-1.1-2.3-2.4z" fill="#16a34a" />
      <path d="M19.2 25.4c1.8-2.9 4.2-5.1 7.2-6.9" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const sizes = {
  md: { mark: 'w-9 h-9', text: 'text-lg' },
  lg: { mark: 'w-10 h-10', text: 'text-xl' },
};

// tone="dark" for white backgrounds, tone="light" for green/dark backgrounds.
// hideTextOnMobile keeps only the mark on very small screens.
export default function Logo({ tone = 'dark', size = 'md', hideTextOnMobile = false, className = '' }) {
  const s = sizes[size] || sizes.md;
  const light = tone === 'light';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={`${s.mark} ${light ? 'ring-1 ring-white/30 rounded-xl' : ''}`} />
      <span className={`${s.text} font-bold tracking-tight ${hideTextOnMobile ? 'hidden sm:block' : ''} ${light ? 'text-white' : 'text-gray-900'}`}>
        Green<span className={light ? 'text-white/85' : 'text-primary-600'}>Place</span>
      </span>
    </span>
  );
}
