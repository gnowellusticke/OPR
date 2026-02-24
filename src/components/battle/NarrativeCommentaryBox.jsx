import React, { useEffect, useRef, useState } from 'react';

const SIGNIFICANCE_STYLES = {
  major:    'border-red-700 bg-red-900/20 text-white',
  notable:  'border-orange-600 bg-orange-900/10 text-slate-100',
  standard: 'border-slate-600 bg-slate-900/30 text-slate-200',
  minor:    'border-slate-700 bg-transparent text-slate-400 text-sm',
};

const TYPEWRITER_SPEED = 18; // ms per character

export default function NarrativeCommentaryBox({ text, significance, round, unit, isStreaming }) {
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef(null);
  const prevTextRef = useRef('');

  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;

    clearInterval(intervalRef.current);

    // Minor events: instant display
    if (significance === 'minor') {
      setDisplayed(text);
      setIsTyping(false);
      return;
    }

    // Typewriter for notable/major/standard
    setDisplayed('');
    setIsTyping(true);
    let i = 0;
    intervalRef.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(intervalRef.current);
        setIsTyping(false);
      }
    }, TYPEWRITER_SPEED);

    return () => clearInterval(intervalRef.current);
  }, [text, significance]);

  const borderClass = SIGNIFICANCE_STYLES[significance] || SIGNIFICANCE_STYLES.standard;

  return (
    <div className={`border-l-4 rounded-r-lg p-3 transition-all duration-300 min-h-[72px] ${borderClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        {unit && (
          <span className="text-xs font-semibold uppercase tracking-wide opacity-60">
            {unit}
            {round != null && <span className="ml-1 opacity-60">· R{round}</span>}
          </span>
        )}
        {significance === 'major' && (
          <span className="text-xs text-red-400 font-bold animate-pulse">● MAJOR EVENT</span>
        )}
        {significance === 'notable' && (
          <span className="text-xs text-orange-400 font-semibold">◆ Notable</span>
        )}
      </div>

      {/* Commentary text */}
      <p className="text-sm leading-relaxed font-serif">
        {displayed}
        {isTyping && <span className="animate-pulse ml-0.5 opacity-70">▋</span>}
      </p>

      {/* Streaming indicator */}
      {isStreaming && !displayed && (
        <div className="flex gap-1 mt-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}