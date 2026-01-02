
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
  private timeStep: number = 0.005; // Mechanism speed

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
  public mode: 'classic' | 'harmonic' = 'classic';

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
    this.frame++;
    // 1. Update Logic
    this.updateLogic();

    // 2. Clear
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);

    if (this.mode === 'harmonic') {
      this.drawHarmonic(ctx, width, height, theme);
    } else {
      this.drawClassic(ctx, width, height, theme);
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

    // Slightly smaller scale to fit the springs
    const scale = Math.min(width, height) * 0.25;

    // Draw Curve first (ghosted/thinner)
    ctx.beginPath();
    ctx.strokeStyle = theme.foreground;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3; // Faint trace

    const samples = 2000;
    const maxT = Math.PI * 2;
    let firstPoint = true;
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * maxT;
      const p = this.getPointAt(t);
      const sx = centerX + p.x * scale;
      const sy = centerY + p.y * scale;
      if (firstPoint) { ctx.moveTo(sx, sy); firstPoint = false; }
      else { ctx.lineTo(sx, sy); }
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // --- Current Point P ---
    // t is constantly increasing in updateLogic
    // We use generic t for trace, but for the dot we need a specific moving t.
    // 'this.t' grows indefinitely, so we wrap it for position calc if needed,
    // but sine handles large values fine.
    const p = this.getPointAt(this.t);
    const px = centerX + p.x * scale;
    const py = centerY + p.y * scale;

    // --- Oscillators ---
    // Visual positions for oscillator tracks
    // Top Oscillator (Horizontal X control)
    const oscX_Y = centerY - scale * 1.8;
    // Left Oscillator (Vertical Y control)
    const oscY_X = centerX - scale * 1.8;

    // 1. Draw Axis/Tracks
    ctx.strokeStyle = theme.foreground;
    ctx.lineWidth = 1;
    // Top Track line
    ctx.beginPath();
    ctx.moveTo(centerX - scale * 1.5, oscX_Y);
    ctx.lineTo(centerX + scale * 1.5, oscX_Y);
    ctx.stroke();
    // Left Track line
    ctx.beginPath();
    ctx.moveTo(oscY_X, centerY - scale * 1.5);
    ctx.lineTo(oscY_X, centerY + scale * 1.5);
    ctx.stroke();

    // 2. Draw Springs
    // Top Spring (Anchored left? Or center?)
    // In physics, normally anchored to a wall. Let's anchor to left side of track.
    // Length depends on x displacement.
    // X goes from -1 to 1. 0 is center.
    // Anchor X:
    const anchorTopX = centerX - scale * 1.5;
    const massTopX = centerX + p.x * scale;
    this.drawSpring(ctx, anchorTopX, oscX_Y, massTopX, oscX_Y, 20, theme.foreground);

    // Left Spring (Anchored top side of track)
    const anchorLeftY = centerY - scale * 1.5;
    const massLeftY = centerY + p.y * scale;
    this.drawSpring(ctx, oscY_X, anchorLeftY, oscY_X, massLeftY, 20, theme.foreground);

    // 3. Draw Masses (Weights)
    const boxSize = 20;

    // Top Mass (moves X)
    ctx.fillStyle = theme.foreground;
    ctx.fillRect(massTopX - boxSize / 2, oscX_Y - boxSize / 2, boxSize, boxSize);

    // Left Mass (moves Y)
    ctx.fillRect(oscY_X - boxSize / 2, massLeftY - boxSize / 2, boxSize, boxSize);

    // 4. Draw Connection Lines (Projectors)
    // Line from Top Mass down to Point
    ctx.strokeStyle = theme.foreground;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(massTopX, oscX_Y); // From mass center
    ctx.lineTo(massTopX, py); // To point Y level (intersect)
    ctx.lineTo(px, py); // To point itself
    ctx.stroke();

    // Line from Left Mass right to Point
    ctx.beginPath();
    ctx.moveTo(oscY_X, massLeftY);
    ctx.lineTo(px, massLeftY); // To point X level
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.setLineDash([]);

    // 5. Draw Result Point
    ctx.fillStyle = theme.foreground; // or accent color?
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spring Helper
  private drawSpring(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, coils: number, color: string) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(0, 0);

    const step = len / coils;
    for (let i = 0; i <= coils; i++) {
      // Zigzag
      const x = i * step;
      const y = (i % 2 === 0 ? -1 : 1) * 6; // Amplitude 6
      // Edges should be flat, so only zigzag in middle?
      // Simple zigzag
      if (i === 0 || i === coils) ctx.lineTo(x, 0);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  public getDebugInfo() {
    return null;
  }

  private updateLogic() {
    this.t += this.timeStep;
    this.timer++;

    if (this.state === 'HOLD') {
      if (this.timer >= this.holdDuration) {
        this.state = 'TRANSITION';
        this.timer = 0;
        this.switchTarget(); // Start moving to next
      }
    } else if (this.state === 'TRANSITION') {
      if (this.timer >= this.transitionDuration) {
        this.state = 'HOLD';
        this.timer = 0;

        // Force snap to target to ensure perfect closed curves during HOLD
        this.currentParams = { ...this.targetParams };
        this.currentVelocity = { a: 0, b: 0, delta: 0 };
      }
    }

    // Apply Spring Physics (Always runs, ensuring smooth movement regardless of state)
    this.applySpringForce('a');
    this.applySpringForce('b');
    this.applySpringForce('delta');
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
    // Non-linear spring: Stiffer when far away (Fast start), softer when close (Slow end)
    const distAbs = Math.abs(displacement);
    const boost = 1 + distAbs * 50; // Huge boost for initial "quick as fuick" movement
    const force = displacement * this.stiffness * boost;

    // Increase damping slightly to prevent overshoot from the high initial velocity
    const dampingForce = this.currentVelocity[key] * (this.damping * 1.5);

    // F = ma -> a = F/m
    const accel = (force - dampingForce) / this.mass;

    this.currentVelocity[key] += accel;
    this.currentParams[key] += this.currentVelocity[key];

    // Snap to target if close enough and slow enough to prevent micro-bouncing/jitter
    // Lower threshold to allow for that "slow end" settling
    if (distAbs < 0.0001 && Math.abs(this.currentVelocity[key]) < 0.0001) {
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
