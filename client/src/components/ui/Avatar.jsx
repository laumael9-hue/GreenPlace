import { useState } from 'react';

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

export default function Avatar({ src, name = '', size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (!src || imgError) {
    return (
      <div className={`${sizeMap[size]} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold ${className}`}>
        {initials || '?'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setImgError(true)}
      className={`${sizeMap[size]} rounded-full object-cover ${className}`}
    />
  );
}
