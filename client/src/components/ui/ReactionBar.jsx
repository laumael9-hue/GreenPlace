import { useState } from 'react';
import { Smile } from 'lucide-react';
import { REACTIONS } from '../../lib/forumReactions';

export default function ReactionBar({ reactionCounts, userReaction, onReact }) {
  const [showPicker, setShowPicker] = useState(false);
  const counts = reactionCounts || {};
  const totalReactions = Object.values(counts).reduce((s, c) => s + c, 0);

  const handleReact = (e, type) => {
    e.stopPropagation();
    e.preventDefault();
    onReact(type);
  };

  const handleTogglePicker = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowPicker(prev => !prev);
  };

  const handlePick = (e, type) => {
    e.stopPropagation();
    e.preventDefault();
    onReact(type);
    setShowPicker(false);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {REACTIONS.map((r) => {
        const count = counts[r.type] || 0;
        const isActive = userReaction === r.type;
        if (count === 0 && !isActive) return null;
        return (
          <button
            key={r.type}
            type="button"
            onClick={(e) => handleReact(e, r.type)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={r.label}
          >
            <span>{r.emoji}</span>
            <span>{count}</span>
          </button>
        );
      })}
      <div className="relative">
        <button
          type="button"
          onClick={handleTogglePicker}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          title="Add reaction"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>
        {showPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowPicker(false); }} />
            <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 flex gap-1 z-20">
              {REACTIONS.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  onClick={(e) => handlePick(e, r.type)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg"
                  title={r.label}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {totalReactions > 0 && (
        <span className="text-xs text-gray-400 ml-1">{totalReactions}</span>
      )}
    </div>
  );
}
