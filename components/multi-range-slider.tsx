import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MultiRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number[];
  onChange: (value: number[]) => void;
  className?: string;
  disabled?: boolean;
}

export function MultiRangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  className,
  disabled
}: MultiRangeSliderProps) {
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Helper to get percentage
  const getPercent = useCallback((val: number) => {
    return ((val - min) / (max - min)) * 100;
  }, [min, max]);

  // Handle Drag
  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(index);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(null);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging === null || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const clientX = e.clientX;

      // Calculate new value
      let percent = (clientX - rect.left) / rect.width;
      percent = Math.max(0, Math.min(1, percent));

      let newValue = min + percent * (max - min);

      // Snap to step
      if (step) {
        newValue = Math.round(newValue / step) * step;
      }

      // Clamp to min/max
      newValue = Math.max(min, Math.min(max, newValue));

      // Constraint: Can't cross neighbors
      // Except first and last which are bound by min/max
      const nextValues = [...value];

      // Lower bound: max(min, previousValue)
      const lowerBound = isDragging > 0 ? nextValues[isDragging - 1] : min;
      // Upper bound: min(max, nextValue)
      const upperBound = isDragging < nextValues.length - 1 ? nextValues[isDragging + 1] : max;

      // Add a tiny buffer so they don't stick perfectly together if we want
      // But for now, strict constraints is fine
      newValue = Math.max(lowerBound, Math.min(upperBound, newValue));

      nextValues[isDragging] = newValue;
      onChange(nextValues);
    };

    if (isDragging !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, step, value, onChange]);

  return (
    <div className={cn("relative w-full h-6 flex items-center select-none", className)}>
      {/* Track */}
      <div
        ref={trackRef}
        className="absolute w-full h-1 bg-border rounded-sm overflow-hidden"
      >
        {/* Fill segments between thumbs? Optional.
            For now just a track.
        */}
      </div>

      {/* Thumbs */}
      {value.map((val, i) => (
        <div
          key={i}
          className={cn(
            "absolute w-3 h-3 -ml-1.5 bg-text-strong border border-background cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-10 rounded-full",
            disabled && "cursor-not-allowed opacity-50"
          )}
          style={{ left: `${getPercent(val)}%` }}
          onMouseDown={handleMouseDown(i)}
        >
          {/* Tooltip on hover/drag could go here */}
        </div>
      ))}
    </div>
  );
}
