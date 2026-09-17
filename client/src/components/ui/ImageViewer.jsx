import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ImageViewer({ images, index, onClose }) {
  const [current, setCurrent] = useState(index);

  useEffect(() => {
    setCurrent(index);
  }, [index]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrent((i) => (i > 0 ? i - 1 : images.length - 1));
      if (e.key === 'ArrowRight') setCurrent((i) => (i < images.length - 1 ? i + 1 : 0));
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [images.length, onClose]);

  if (index === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors">
        <X className="w-6 h-6" />
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setCurrent((i) => (i > 0 ? i - 1 : images.length - 1)); }}
          className="absolute left-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      <img
        src={images[current]}
        alt={`View ${current + 1}`}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setCurrent((i) => (i < images.length - 1 ? i + 1 : 0)); }}
          className="absolute right-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-4 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/40 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
