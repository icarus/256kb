
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import CanvasSketch from '@/components/canvas-sketch';
import { LissajousSketch } from '@/lib/sketches/lissajous';
import { PixelatorSketch } from '@/lib/sketches/pixelator';

import { useCanvasRecorder } from '@/lib/use-canvas-recorder';
import { cn } from '@/lib/utils';
import { ChevronDown, ArrowRightLeft } from 'lucide-react';

// Sketch Registry
const SKETCHES = {
  'lissajous': LissajousSketch,
  'pixelator': PixelatorSketch,
};

type SketchKey = keyof typeof SKETCHES;

// Preset Colors from Tokens just for the Sketch Canvas (Not UI)
const COLORS = [
  { bg: '#000000', fg: '#FFFFFF', label: 'classic' },
  { bg: '#FFFFFF', fg: '#000000', label: 'ink' },
  { bg: '#BBBBBB', fg: '#E4FF60', label: 'acid' }, // Dark 2 is #1A1819
  { bg: '#0000ee', fg: '#FFFFFF', label: 'pure' }, // Light 5 (#E2E2E2), Light 12 (#201E1F)
  { bg: '#BBBBBB', fg: '#0000ee', label: 'raw' },  // Light 8 (#BBBBBB)
];

export default function Home() {
  const [activeSketch, setActiveSketch] = useState<SketchKey>('lissajous');
  const [theme, setTheme] = useState(COLORS[2]);
  const [quality, setQuality] = useState<'hq' | '256kb'>('hq');
  const [resetKey, setResetKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Physics Params
  const [stiffness, setStiffness] = useState(0.025);
  const [damping, setDamping] = useState(0.283);
  const [mass, setMass] = useState(1);
  const [noBounce, setNoBounce] = useState(false);

  // Timing Params (Constrained to 10s total)
  const [steps, setSteps] = useState(8); // Fixed to 8
  const [split, setSplit] = useState(0.45);

  // Lissajous Params
  const [lissajousMode, setLissajousMode] = useState<'classic' | 'harmonic'>('classic');

  // Pixelator Params
  const [tiles, setTiles] = useState(40);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [zoom, setZoom] = useState(1);
  const [skin, setSkin] = useState<'default' | 'minesweeper'>('default');
  const [invert, setInvert] = useState(false);

  const [fps, setFps] = useState(0);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const SketchClass = SKETCHES[activeSketch];
  // Force new instance when resetKey changes (allows hot-reloading logic or resetting state)
  const sketch = useMemo(() => new SketchClass(), [activeSketch, resetKey]);


  // Sync Pixelator Params
  // Sync Pixelator Params
  useEffect(() => {
    if (sketch instanceof PixelatorSketch) {
      sketch.cols = tiles;
      sketch.tileTypes = 5;
      sketch.fitMode = fitMode;
      sketch.zoom = zoom;
      sketch.skin = skin;
      sketch.invert = invert;
    }
  }, [sketch, tiles, fitMode, zoom, skin, invert]);

  // Sync physics params to sketch
  useEffect(() => {
    if (sketch instanceof LissajousSketch) {
      sketch.stiffness = stiffness;
      sketch.damping = damping;
      sketch.mass = mass;

      const stepDuration = 10 / steps;
      const transitionDuration = stepDuration * split;
      const holdDuration = stepDuration - transitionDuration;

      sketch.holdDuration = holdDuration * 60;
      sketch.transitionDuration = transitionDuration * 60;
      sketch.mode = lissajousMode;
    }
  }, [sketch, stiffness, damping, mass, steps, split, lissajousMode]);

  // Critical Damping Calculator
  useEffect(() => {
    if (noBounce) {
      // Critical Damping c = 2 * sqrt(k * m)
      const critical = 2 * Math.sqrt(stiffness * mass);
      // We do not clamp so we ensure no bounce even at high stiffness/mass
      setDamping(critical);
    }
  }, [stiffness, mass, noBounce]);

  const handleUpdate = (time: number, newFps: number) => {
    setElapsed(time % 10);
    setFps(newFps);
    if (sketch instanceof LissajousSketch) {
      setDebugInfo(sketch.getDebugInfo());
    }
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { startRecording, isRecording } = useCanvasRecorder(canvasRef);

  // Helper for UI display
  const stepDur = 10 / steps;
  const transTime = stepDur * split;
  const holdTime = stepDur - transTime;

  const handleExport = () => {
    if (isRecording) return;
    setResetKey(prev => prev + 1);

    // HQ = 25Mbps, 256kb ~ 350kbps target
    const bitrate = quality === 'hq' ? 25000000 : 350000;

    setTimeout(() => startRecording(bitrate), 150);
  };

  return (
    // Use Light Theme Semantic Variables for UI
    <main className="w-screen h-screen bg-background text-text font-mono text-xs overflow-hidden flex selection:bg-accent selection:text-white">
      {/* Canvas Stage */}
      <div className="flex-1 flex items-center justify-center relative">
        <div className="relative border border-border">
          <CanvasSketch
            key={resetKey}
            ref={canvasRef}
            sketch={sketch}
            width={1080}
            height={1350}
            className="h-[60vh] w-auto aspect-[4/5]"
            foregroundColor={theme.fg}
            backgroundColor={theme.bg}
            onUpdate={handleUpdate}
          />
          {isRecording && (
            <div className="absolute top-0 w-full h-1 bg-red-900/20">
              <div className="h-full bg-red-600 animate-[progress_10s_linear_forwards]" />
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Controls - Brutalist / Minimal */}
      <div className="max-w-xs w-full h-full p-8 space-y-8">
        {/* Sketch Selector */}
        <div className="space-y-2">
          <label className="text-text">sketch</label>
          <div className="relative group">
            <select
              value={activeSketch}
              onChange={(e) => setActiveSketch(e.target.value as SketchKey)}
              className="w-full text-text-strong p-2 rounded-none border border-border outline-none appearance-none hover:border-text-weak focus:border-text-strong transition-colors cursor-pointer"
            >
              {Object.keys(SKETCHES).map(key => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 w-4 h-4 text-text pointer-events-none" />
          </div>
        </div>

        {activeSketch === 'lissajous' && (
          <div className="space-y-2">
            <label className="text-text">palette</label>
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setTheme(c)}
                  className={cn(
                    "w-full aspect-square border-2 transition-all relative overflow-hidden group",
                    theme.label === c.label ? "border-black" : "border-border"
                  )}
                  style={{ backgroundColor: c.bg }}
                  title={c.label}
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.fg }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2 items-start">
              <div className="flex-1 space-y-1">
                <input
                  type="color"
                  value={theme.bg}
                  onChange={(e) => setTheme(p => ({ ...p, bg: e.target.value }))}
                  className="w-full h-6 bg-transparent border border-border cursor-pointer p-0"
                />
                <div className="text-xs text-text text-center uppercase">{theme.bg}</div>
              </div>

              <button
                onClick={() => setTheme(p => ({ ...p, bg: p.fg, fg: p.bg }))}
                className="h-6 w-6 flex items-center justify-center border border-border text-text hover:bg-text-strong hover:text-text-inverted transition-colors"
                title="invert colors"
              >
                <ArrowRightLeft className="w-3 h-3" />
              </button>

              <div className="flex-1 space-y-1">
                <input
                  type="color"
                  value={theme.fg}
                  onChange={(e) => setTheme(p => ({ ...p, fg: e.target.value }))}
                  className="w-full h-6 bg-transparent border border-border cursor-pointer p-0"
                />
                <div className="text-xs text-text text-center uppercase">{theme.fg}</div>
              </div>
            </div>
          </div>
        )}

        {activeSketch === 'lissajous' && (
          <div className="space-y-4">
            <label className="text-text block">physics / elastic</label>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span>stiffness</span>
                <span className="text-text-main">{stiffness.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.2"
                step="0.001"
                value={stiffness}
                onChange={(e) => setStiffness(parseFloat(e.target.value))}
                className="w-full accent-text-strong cursor-grab active:cursor-grabbing"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span>damping</span>
                <span className="text-text-main">{damping.toFixed(3)}</span>
              </div>

              <div className="space-y-4 pt-4 border-t border-border mt-4">
                <label className="text-text uppercase text-xs font-bold tracking-wider opacity-50">Visualization</label>
                <div className="flex border border-border rounded-sm overflow-hidden">
                  <button
                    onClick={() => setLissajousMode('classic')}
                    className={cn(
                      "flex-1 py-1 text-xs transition-colors uppercase",
                      lissajousMode === 'classic' ? "bg-text-strong text-text-inverted" : "hover:bg-background-weak"
                    )}
                  >
                    Classic
                  </button>
                  <button
                    onClick={() => setLissajousMode('harmonic')}
                    className={cn(
                      "flex-1 py-1 text-xs transition-colors uppercase",
                      lissajousMode === 'harmonic' ? "bg-text-strong text-text-inverted" : "hover:bg-background-weak"
                    )}
                  >
                    Harmonic
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.001"
                  max="2.0"
                  step="0.001"
                  disabled={noBounce}
                  value={damping}
                  onChange={(e) => setDamping(parseFloat(e.target.value))}
                  className={cn(
                    "w-full accent-text-strong cursor-grab active:cursor-grabbing",
                    noBounce && "opacity-50 cursor-not-allowed"
                  )}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span>mass</span>
                <span className="text-text-main">{mass.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={mass}
                onChange={(e) => setMass(parseFloat(e.target.value))}
                className="w-full accent-text-strong cursor-grab active:cursor-grabbing"
              />
            </div>

            <div className="pt-4 space-y-4">
              <label className="text-text block">timing (10s total)</label>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>move ratio</span>
                  <span className="text-text-main">{(split * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={split}
                  onChange={(e) => setSplit(parseFloat(e.target.value))}
                  className="w-full accent-text-strong cursor-grab active:cursor-grabbing"
                />
                <div className="flex justify-between text-xs text-text-weak pt-1">
                  <span>move: {transTime.toFixed(2)}s</span>
                  <span>hold: {holdTime.toFixed(2)}s</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSketch === 'pixelator' && (
          <div className="space-y-4">
            {/* Pixelator specific controls */}
            <div className="space-y-4 pt-4">
              <label className="text-text block">source</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && sketch instanceof PixelatorSketch) {
                    const url = URL.createObjectURL(file);
                    sketch.setVideoUrl(url);
                  }
                }}
              />

              <div className="space-y-2">
                <label className="text-text">skin</label>
                <div className="relative group">
                  <select
                    value={skin}
                    onChange={(e) => setSkin(e.target.value as any)}
                    className="w-full text-text-strong p-2 rounded-none border border-border outline-none appearance-none hover:border-text-weak focus:border-text-strong transition-colors cursor-pointer"
                  >
                    <option value="default">Default</option>
                    <option value="minesweeper">Minesweeper</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 w-4 h-4 text-text pointer-events-none" />
                </div>
              </div>

              <button
                onClick={() => setInvert(!invert)}
                className={cn(
                  "w-full py-1 text-xs border border-border uppercase transition-colors",
                  invert ? "bg-text-strong text-text-inverted" : "hover:bg-background-weak"
                )}
              >
                Invert Tiles
              </button>

              <div className="flex border border-border rounded-sm overflow-hidden">
                <button
                  onClick={() => setFitMode('cover')}
                  className={cn("flex-1 py-1 text-xs transition-colors uppercase", fitMode === 'cover' ? 'bg-text-strong text-text-inverted' : 'hover:bg-background-weak')}
                >
                  Cover (Fill)
                </button>
                <button
                  onClick={() => setFitMode('contain')}
                  className={cn("flex-1 py-1 text-xs transition-colors uppercase", fitMode === 'contain' ? 'bg-text-strong text-text-inverted' : 'hover:bg-background-weak')}
                >
                  Fit (Full)
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-text uppercase">
                  <label>Zoom</label>
                  <span>{zoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-text-strong cursor-grab active:cursor-grabbing"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span>resolution (cols)</span>
                <span className="text-text-main">{tiles}</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="1"
                value={tiles}
                onChange={(e) => setTiles(parseInt(e.target.value))}
                className="w-full accent-text-strong cursor-grab active:cursor-grabbing"
              />
            </div>
          </div>
        )}

        {/* Stats / Info */}
        <div className="mt-auto space-y-3 text-text">
          <div className="flex justify-between">
            <span>dim</span>
            <span className="text-text-main">1080x1350</span>
          </div>
          <div className="flex justify-between">
            <span>fps</span>
            <span className="text-text-main">{fps} / 60</span>
          </div>
          <div className="flex justify-between">
            <span>len</span>
            <span className="text-text-main">{elapsed.toFixed(1)}s / 10s</span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span>quality</span>
            <div className="flex border border-border rounded-sm overflow-hidden">
              <button
                onClick={() => setQuality('hq')}
                className={cn("px-2 py-0.5 text-xs transition-colors", quality === 'hq' ? 'bg-text-strong text-text-inverted' : 'hover:bg-background-weak')}
              >
                HQ
              </button>
              <button
                onClick={() => setQuality('256kb')}
                className={cn("px-2 py-0.5 text-xs transition-colors", quality === '256kb' ? 'bg-text-strong text-text-inverted' : 'hover:bg-background-weak')}
              >
                256kb
              </button>
            </div>
          </div>

          <div className="flex justify-between">
            <span>est. size</span>
            <div className="text-right">
              <span className="text-text-main block">
                {quality === 'hq'
                  ? `~${(25000000 * 10 / 8 / 1024 / 1024).toFixed(1)} MB`
                  : `~${(350000 * 10 / 8 / 1024 / 1024).toFixed(2)} MB`
                }
              </span>
              <span className="text-[10px] text-text-weak block">
                {quality === 'hq' ? 'at 25 Mbps' : 'at 350 Kbps'}
              </span>
            </div>
          </div>


        </div>

        {/* Action */}
        <button
          onClick={handleExport}
          disabled={isRecording}
          className={cn(
            "w-full h-10 mt-auto border text-center transition-all uppercase tracking-widest text-xs hover:bg-text-strong hover:text-text-inverted",
            isRecording
              ? "border-red-900 text-red-700 cursor-not-allowed bg-red-50"
              : "border-border text-text-strong bg-background-weak"
          )}
        >
          {isRecording ? 'recording...' : `export ${quality === 'hq' ? 'HQ' : '256kb'}`}
        </button>

      </div>

      <style jsx global>{`
          @keyframes progress {
              from { width: 0%; }
              to { width: 100%; }
          }
      `}</style>
    </main >
  );
}
