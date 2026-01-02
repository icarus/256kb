
export interface SketchContext {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  time: number; // Global time
  deltaTime: number;
  frame: number;
  theme: {
    foreground: string;
    background: string;
  }
}

export interface Sketch {
  // Called once when sketch starts
  setup(ctx: SketchContext): void;

  // Called every frame
  draw(ctx: SketchContext): void;

  // Called when dimensions change
  resize?(width: number, height: number): void;

  // Cleanup
  destroy?(): void;
}
