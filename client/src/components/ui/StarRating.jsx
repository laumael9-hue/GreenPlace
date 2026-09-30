import { useState } from 'react';
import { Star } from 'lucide-react';

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export default function StarRating({ value = 0, onChange, size = 'md', className = '' }) {
  const [hovered, setHovered] = useState(0);
  const interactive = typeof onChange === 'function';
  const active = interactive && hovered ? hovered : value;
  const starSize = sizes[size] || sizes.md;

  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      onMouseLeave={() => setHovered(0)}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`Rating: ${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            className={`${starSize} ${
              star <= active ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
