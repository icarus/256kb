
'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Sketch } from '@/lib/sketches/types';
import { cn } from '@/lib/utils';

// Standardized props for all sketches
interface CanvasSketchProps {
  sketch: Sketch;
  className?: string;
  width?: number; // Internal resolution width
  height?: number; // Internal resolution height
  foregroundColor?: string;
  backgroundColor?: string;
}

const CanvasSketch = forwardRef<HTMLCanvasElement, CanvasSketchProps>(
  ({ sketch, className, width = 1080, height = 1350, foregroundColor, backgroundColor }, ref) => {
    const internalCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => internalCanvasRef.current!);

    useEffect(() => {
      const canvas = internalCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Internal Resolution
      canvas.width = width;
      canvas.height = height;

      // Render loop state
      let animationFrameId: number;
      let startTime = performance.now();
      let lastTime = startTime;
      let frameCount = 0;

      // Resolve theme colors
      const getTheme = () => {
        const getCssVar = (name: string) => {
          if (typeof document === 'undefined') return '#ffffff';
          return getComputedStyle(document.body).getPropertyValue(name).trim();
        };
        return {
          foreground: foregroundColor || getCssVar('--foreground') || '#ffffff',
          background: backgroundColor || getCssVar('--background') || '#000000'
        };
      };

      // Setup
      sketch.setup({
        ctx,
        width,
        height,
        time: 0,
        deltaTime: 0,
        frame: 0,
        theme: getTheme()
      });

      const loop = (now: number) => {
        const time = (now - startTime) / 1000;
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;
        frameCount++;

        sketch.draw({
          ctx,
          width,
          height,
          time,
          deltaTime,
          frame: frameCount,
          theme: getTheme()
        });

        animationFrameId = requestAnimationFrame(loop);
      };

      loop(startTime);

      return () => {
        cancelAnimationFrame(animationFrameId);
        if (sketch.destroy) sketch.destroy();
      };
    }, [sketch, width, height, foregroundColor, backgroundColor]);

    return (
      <div
        ref={containerRef}
        className={cn(
          "relative flex items-center justify-center bg-transparent",
          className
        )}
      >
        <canvas
          ref={internalCanvasRef}
          className="w-full h-full object-contain bg-black"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>
    );
  }
);

CanvasSketch.displayName = 'CanvasSketch';
export default CanvasSketch;
