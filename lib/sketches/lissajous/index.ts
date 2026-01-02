
import { Sketch, SketchContext } from '../types';

// We reuse the logic from LissajousCore but adapted to the Sketch interface
interface Phase {
  a: number;
  b: number;
  delta: number;
}

interface Params {
  a: number;
  b: number;
  delta: number;
}

export class LissajousSketch implements Sketch {
  private t: number = 0;
  private timeStep: number = 0.01; // Mechanism speed (Faster)

  private phases: Phase[] = [
    { a: 1, b: 1, delta: Math.PI / 2 },
    { a: 1, b: 2, delta: Math.PI / 2 },
    { a: 1, b: 3, delta: Math.PI / 2 },
    { a: 3, b: 4, delta: Math.PI / 2 }, // Skipped 2:3 as requested
    { a: 3, b: 5, delta: Math.PI / 2 },
  ];

  private currentPhaseIndex: number = 0;
  private direction: number = 1;

  // Physics params (Public for UI/Editor)
  public stiffness: number = 0.02;
  public damping: number = 0.2;
  public mass: number = 1;

  // Mode Handling
  private _mode: 'classic' | 'harmonic' | 'table' = 'classic';

  public get mode() { return this._mode; }
  public set mode(v: 'classic' | 'harmonic' | 'table') {
    if (this._mode !== v) {
      this._mode = v;
      // Reset physics when switching modes to prevent "carrying over" momentum
      this.currentVelocity = { a: 0, b: 0, delta: 0 };
      // Optional: Snap to target to be clean?
      // this.currentParams = { ...this.targetParams };
    }
  }

  // Timing params (Public for UI/Editor)
  public holdDuration: number = 2 * 60; // frames
  public transitionDuration: number = 2 * 60; // frames

  private state: 'HOLD' | 'TRANSITION' = 'HOLD';
  private timer: number = 0;
  private frame: number = 0;

  private currentParams: Params;
  private currentVelocity: Params;
  private targetParams: Params;

  constructor() {
    this.currentParams = { ...this.phases[0] };
    this.currentVelocity = { a: 0, b: 0, delta: 0 };
    this.targetParams = { ...this.phases[0] };
  }

  setup(ctx: SketchContext) {
    // Init logic if needed
  }

  draw({ ctx, width, height, theme }: SketchContext) {
    try {
      this.frame++;
      // 1. Update Logic
      this.updateLogic();

      // 2. Clear
      ctx.fillStyle = theme.background;
      ctx.fillRect(0, 0, width, height);

      if (this.mode === 'harmonic') {
        this.drawHarmonic(ctx, width, height, theme);
      } else if (this.mode === 'table') {
        this.drawTable(ctx, width, height, theme);
      } else {
        this.drawClassic(ctx, width, height, theme);
      }
    } catch (e) {
      console.error("Lissajous Draw Error:", e);
    }
  }

  // Original drawing logic
  private drawClassic(ctx: CanvasRenderingContext2D, width: number, height: number, theme: { foreground: string, background: string }) {
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) * 0.35;

    ctx.beginPath();
    ctx.strokeStyle = theme.foreground;
    ctx.lineWidth = width * 0.004;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const samples = 4000;
    const maxT = Math.PI * 2;
    let firstPoint = true;
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * maxT;
      const p = this.getPointAt(t);
      const sx = centerX + p.x * scale;
      const sy = centerY + p.y * scale;

      if (firstPoint) {
        ctx.moveTo(sx, sy);
        firstPoint = false;
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.stroke();
  }

  private drawHarmonic(ctx: CanvasRenderingContext2D, width: number, height: number, theme: { foreground: string, background: string }) {
    const centerX = width / 2;
    const centerY = height / 2;

    // Use Classic Scale (0.35)
    const scale = Math.min(width, height) * 0.35;

    // Draw Curve first
    ctx.beginPath();
    ctx.strokeStyle = theme.foreground;
    // Use Classic Stroke Width
    ctx.lineWidth = width * 0.004;
    ctx.lineCap = 'round'; // Match classic

    // User requested "maintain the same size and stroke width from classic"
    // implies no ghosting opacity, so we keep alpha 1.0 or remove it.
    ctx.globalAlpha = 1.0;

    const samples = 2000;
    const maxT = Math.PI * 2;
    let firstPoint = true;

    // Draw Curve - Uses fixed 1:1 parameters as requested
    const hA = 1;
    const hB = 1;
    const hDelta = Math.PI / 2;

    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * maxT;
      const R = 1;
      const x = R * Math.sin(hA * t + hDelta);
      const y = R * Math.sin(hB * t);

      const sx = centerX + x * scale;
      const sy = centerY + y * scale;
      if (firstPoint) { ctx.moveTo(sx, sy); firstPoint = false; }
      else { ctx.lineTo(sx, sy); }
    }
    ctx.stroke();

    // --- Current Point P (Strictly 1:1 for Harmonic Mode) ---
    // User requested "always alpha to 1 and beta to 1" for this mode.
    // We ignore the physics sequencing params and force 1:1 here.
    const R = 1;
    const physA = 1;
    const physB = 1;
    const physDelta = Math.PI / 2;

    // We use this.t to animate the position along the fixed circle
    const px_val = R * Math.sin(physA * this.t + physDelta);
    const py_val = R * Math.sin(physB * this.t);

    const px = centerX + px_val * scale;
    const py = centerY + py_val * scale;

    // --- Oscillators ---
    const oscOffset = 1.2;

    // Top Oscillator (Horizontal X control)
    const oscX_Y = centerY - scale * oscOffset;

    // Left Oscillator (Vertical Y control)
    const oscY_X = centerX - scale * oscOffset;

    // Use pure black for the mechanism as requested
    const mechanismColor = '#000000';
    const strokeWidth = width * 0.002;

    // 1. Draw Axis/Tracks (Top and Left Only)
    ctx.strokeStyle = mechanismColor;
    ctx.lineWidth = strokeWidth;

    // Top Track line
    ctx.beginPath();
    ctx.moveTo(centerX - scale, oscX_Y);
    ctx.lineTo(centerX + scale, oscX_Y);
    ctx.stroke();

    // Left Track line
    ctx.beginPath();
    ctx.moveTo(oscY_X, centerY - scale);
    ctx.lineTo(oscY_X, centerY + scale);
    ctx.stroke();

    // 2. Draw Springs (Top and Left Only)
    // Top Spring (Anchor Left)
    const anchorX = centerX - scale;
    const massX = centerX + px_val * scale;
    this.drawSpring(ctx, anchorX, oscX_Y, massX, oscX_Y, 20, mechanismColor, strokeWidth);

    // Left Spring (Anchor Top)
    const anchorY = centerY - scale;
    const massY = centerY + py_val * scale;
    this.drawSpring(ctx, oscY_X, anchorY, oscY_X, massY, 20, mechanismColor, strokeWidth);

    // 3. Draw Masses (Top and Left Only)
    const boxSize = 20;

    // Top Mass (moves X)
    ctx.fillStyle = mechanismColor;
    ctx.fillRect(massX - boxSize / 2, oscX_Y - boxSize / 2, boxSize, boxSize);

    // Left Mass (moves Y)
    ctx.fillRect(oscY_X - boxSize / 2, massY - boxSize / 2, boxSize, boxSize);

    // 4. Draw Connection Lines (Projectors)
    ctx.strokeStyle = mechanismColor;
    ctx.setLineDash([]);
    ctx.lineWidth = strokeWidth;

    // X Projector (From Top Mass to Point P)
    ctx.beginPath();
    ctx.moveTo(massX, oscX_Y);
    ctx.lineTo(massX, py);
    ctx.stroke();

    // Y Projector (From Left Mass to Point P)
    ctx.beginPath();
    ctx.moveTo(oscY_X, massY);
    ctx.lineTo(px, massY);
    ctx.stroke();

    // 5. Draw Result Point
    ctx.fillStyle = mechanismColor;
    ctx.fillRect(px - boxSize / 2, py - boxSize / 2, boxSize, boxSize);
  }

  // Spring Helper - Simplified to straight line
  private drawSpring(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, coils: number, color: string, width: number) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawTable(ctx: CanvasRenderingContext2D, width: number, height: number, theme: { foreground: string, background: string }) {
    // Grid Setup
    const ratios = [
      { a: 1, b: 1, label: '1:1' },
      { a: 1, b: 2, label: '1:2' },
      { a: 1, b: 3, label: '1:3' },
      { a: 2, b: 3, label: '2:3' },
      { a: 3, b: 4, label: '3:4' },
      { a: 3, b: 5, label: '3:5' },
      { a: 4, b: 5, label: '4:5' },
      { a: 5, b: 6, label: '5:6' },
    ];

    const deltas = [
      { val: 0, label: '0' },
      { val: Math.PI / 4, label: 'π/4' },
      { val: Math.PI / 2, label: 'π/2' },
      { val: 3 * Math.PI / 4, label: '3π/4' },
      { val: Math.PI, label: 'π' },
    ];

    const rows = ratios.length;
    const cols = deltas.length;

    // Layout
    // Increase font size
    const fontSize = width * 0.02;

    // Attempt to use Geist Mono via CSS variable or fallback
    let fontFamily = 'monospace';
    if (typeof window !== 'undefined') {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono');
      if (computed) fontFamily = computed.trim();
    }

    if (!fontFamily) fontFamily = 'monospace';

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = theme.foreground;
    ctx.fillStyle = theme.foreground;
    ctx.lineWidth = width * 0.0015;

    // Calculate Square Grid
    // We want the grid area to be square
    const padding = width * 0.05;
    const labelMarginL = fontSize * 3;
    const labelMarginT = fontSize * 2;

    // Available size for the grid
    const availW = width - (padding * 2) - labelMarginL;
    const availH = height - (padding * 2) - labelMarginT;
    const gridSize = Math.min(availW, availH); // Square size

    // Where does the grid start? Center it.
    const gridStartX = padding + labelMarginL + (availW - gridSize) / 2;
    const gridStartY = padding + labelMarginT + (availH - gridSize) / 2;

    const cellW = gridSize / cols;
    const cellH = gridSize / rows;
    const cellSize = Math.min(cellW, cellH) * 0.8;

    // Draw Column Headers (Deltas)
    for (let c = 0; c < cols; c++) {
      const cx = gridStartX + c * cellW + cellW / 2;
      const cy = gridStartY - labelMarginT / 2;
      ctx.fillText(deltas[c].label, cx, cy);
    }

    // Draw Row Headers & Curves
    for (let r = 0; r < rows; r++) {
      const cy = gridStartY + r * cellH + cellH / 2;

      // Row Label
      ctx.textAlign = 'right';
      const labelX = gridStartX - fontSize / 2;
      ctx.fillText(ratios[r].label, labelX, cy);
      ctx.textAlign = 'center';

      for (let c = 0; c < cols; c++) {
        const cx = gridStartX + c * cellW + cellW / 2;

        // Draw Small Lissajous
        ctx.beginPath();
        const samples = 100;
        const a = ratios[r].a;
        const b = ratios[r].b;
        const delta = deltas[c].val;

        for (let i = 0; i <= samples; i++) {
          const t = (i / samples) * Math.PI * 2;
          const rad = cellSize / 2;
          const x = cx + rad * Math.sin(a * t + delta);
          const y = cy + rad * Math.sin(b * t);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  public getDebugInfo() {
    return null;
  }

  private updateLogic() {
    this.t += this.timeStep;
    this.timer++;

    // Apply Physics first so we can check settlement status
    this.applySpringForce('a');
    this.applySpringForce('b');
    this.applySpringForce('delta');

    // Check if physically settled (at target params)
    // The applySpringForce method snaps to target when very close/slow, so exact equality check works.
    const isSettled =
      this.currentParams.a === this.targetParams.a &&
      this.currentParams.b === this.targetParams.b &&
      this.currentParams.delta === this.targetParams.delta;

    if (this.state === 'HOLD') {
      if (this.timer >= this.holdDuration) {
        this.state = 'TRANSITION';
        this.timer = 0;
        this.switchTarget(); // Start moving to next
      }
    } else if (this.state === 'TRANSITION') {
      let shouldFinish = false;

      if (this.mode === 'harmonic') {
        // In Harmonic mode, we let the physics dictate the duration.
        // We wait until settled, or a safety timeout (e.g., 1800 frames = 30s)
        if (isSettled || this.timer > 1800) {
          shouldFinish = true;
        }
      } else {
        // Classic mode / Table mode follows strict timing
        if (this.timer >= this.transitionDuration) {
          shouldFinish = true;
        }
      }

      if (shouldFinish) {
        this.state = 'HOLD';
        this.timer = 0;

        // Force snap ensure perfect closed curves during HOLD
        this.currentParams = { ...this.targetParams };
        this.currentVelocity = { a: 0, b: 0, delta: 0 };
      }
    }
  }

  private switchTarget() {
    const prevIndex = this.currentPhaseIndex;
    let nextIndex = this.currentPhaseIndex + this.direction;

    if (nextIndex >= this.phases.length) {
      this.direction = -1;
      nextIndex = this.phases.length - 2;
    } else if (nextIndex < 0) {
      this.direction = 1;
      nextIndex = 1;
    }

    console.log(`SWITCH TARGET: ${prevIndex} -> ${nextIndex} (Dir: ${this.direction})`);

    this.currentPhaseIndex = nextIndex;
    this.targetParams = this.phases[nextIndex];
  }

  private applySpringForce(key: keyof Params) {
    const displacement = this.targetParams[key] - this.currentParams[key];
    const distAbs = Math.abs(displacement);

    // Default Linear Physics
    let force = displacement * this.stiffness;
    let dampingFactor = this.damping;

    // Harmonic Mode: Exaggerated "Quick Start / Slow End"
    // We use a non-linear spring that is extremely stiff when far (explosive start)
    // and correctly damped to settle slowly without overshooting.
    if (this.mode === 'harmonic') {
      // -- Harmonic Mode Physics Configuration (Interpolated Stiffness) --
      // This maps distance directly to stiffness for precise control.

      const maxStiffness = 1.0;   // Stiffness at large distance (Explosive start)
      const minStiffness = 0.00001; // Stiffness at target (Crawling end - Extreme)
      const tensionPower = 6.0;   // Curve shape. Higher = Stiffness drops earlier, creating a longer slow tail.
      const dampZeta = 4.0;       // Damping ratio. Higher = More 'syrupy' resistance.

      // Normalize distance (clamp to 1.0)
      // We assume mostly 0->1 range. If dist > 1, we treat it as max speed.
      const distNorm = Math.min(distAbs, 1.0);

      // Interpolate Stiffness
      // k = min + (max - min) * (dist^power)
      const k_eff = minStiffness + (maxStiffness - minStiffness) * Math.pow(distNorm, tensionPower);

      // Apply Force
      force = displacement * k_eff;

      // Calculate Damping
      // Critical Damping c = 2 * sqrt(m * k)
      const c_crit = 2 * Math.sqrt(this.mass * k_eff);
      dampingFactor = c_crit * dampZeta;

      // Override snap threshold to be extremely fine in harmonic mode
      // so it doesn't snap while 'crawling'
      if (distAbs < 0.00001 && Math.abs(this.currentVelocity[key]) < 0.00001) {
        this.currentParams[key] = this.targetParams[key];
        this.currentVelocity[key] = 0;
        return; // Skip integration
      }
    }

    const dampingForce = this.currentVelocity[key] * dampingFactor;

    // F = ma -> a = F/m
    const accel = (force - dampingForce) / this.mass;

    this.currentVelocity[key] += accel;
    this.currentParams[key] += this.currentVelocity[key];

    // Snap to target
    // Classic needs standard snap, Harmonic needs fine snap for slow settlement
    const snapThreshold = this.mode === 'harmonic' ? 0.0001 : 0.001;
    const velThreshold = this.mode === 'harmonic' ? 0.0001 : 0.001;

    if (distAbs < snapThreshold && Math.abs(this.currentVelocity[key]) < velThreshold) {
      this.currentParams[key] = this.targetParams[key];
      this.currentVelocity[key] = 0;
    }
  }

  private getPointAt(t: number) {
    const R = 1;

    // We now respect the user keyframes for delta!
    // But we stick to the sin/sin formulation for consistency.
    // x = A sin(at + delta)
    // y = B sin(bt)

    const x = R * Math.sin(this.currentParams.a * t + this.currentParams.delta);
    const y = R * Math.sin(this.currentParams.b * t);

    return { x, y };
  }
}
