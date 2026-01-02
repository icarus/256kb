
import { Sketch, SketchContext } from '../types';

export class PixelatorSketch implements Sketch {
  private video: HTMLVideoElement | null = null;
  private isVideoReady: boolean = false;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  // Params
  public cols: number = 40;
  public tileTypes: number = 5;
  public fitMode: 'cover' | 'contain' = 'cover';
  public zoom: number = 1;
  public skin: 'default' | 'minesweeper' = 'default';
  public invert: boolean = false;
  public thresholds: number[] = [];

  // Font
  private fontFamily: string = 'monospace';

  // Throttle (Slower updates)
  public fps: number = 60;
  private lastUpdate: number = 0;

  // Computed
  private tileSize: number = 0;
  private rows: number = 0;

  // Buffers
  private renderCanvas: HTMLCanvasElement | null = null;
  private renderCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.video = document.createElement('video');
      this.video.src = '/sculpture.mp4';
      this.video.loop = true;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.autoplay = true;

      this.video.onloadeddata = () => {
        this.isVideoReady = true;
        this.video?.play();
      };
    }
  }

  setup({ width, height }: SketchContext) {
    if (typeof window !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

      this.renderCanvas = document.createElement('canvas');
      this.renderCtx = this.renderCanvas.getContext('2d');
    }
    this.recalculateGrid(width, height);
  }

  private recalculateGrid(width: number, height: number) {
    this.tileSize = width / this.cols;
    this.rows = Math.ceil(height / this.tileSize);

    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = this.cols;
      this.offscreenCanvas.height = this.rows;
    }

    if (this.renderCanvas) {
      this.renderCanvas.width = width;
      this.renderCanvas.height = height;
      this.lastUpdate = 0;
    }
  }

  public setVideoUrl(url: string) {
    if (this.video) {
      this.video.src = url;
      this.video.play();
    }
  }

  draw({ ctx, width, height, theme }: SketchContext) {
    // Attempt to fetch correct font if we haven't yet (or if it's still default)
    if (typeof window !== 'undefined' && this.fontFamily === 'monospace') {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono');
      if (computed) this.fontFamily = computed.trim();
    }

    if (Math.abs(width / this.cols - this.tileSize) > 0.1) {
      this.recalculateGrid(width, height);
    }

    if (!this.renderCanvas || !this.renderCtx) return;

    // --- Update Loop (Throttled) ---
    const now = performance.now();
    const interval = 1000 / this.fps;

    if (now - this.lastUpdate > interval) {
      this.lastUpdate = now - (now % interval);

      if (!this.video || !this.isVideoReady || !this.offscreenCtx || !this.offscreenCanvas) {
        this.renderCtx.fillStyle = "#000000";
        this.renderCtx.fillRect(0, 0, width, height);
        this.renderCtx.fillStyle = "#ffffff";
        this.renderCtx.fillText("Loading Video...", 20, 20);
      } else {
        // Clear render buffer
        this.renderCtx.fillStyle = "#000000";
        this.renderCtx.fillRect(0, 0, width, height);

        // Clear tiny offscreen
        this.offscreenCtx.fillStyle = "#000000";
        this.offscreenCtx.fillRect(0, 0, this.cols, this.rows);

        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;
        const videoAspect = vw / vh;
        const targetAspect = this.cols / this.rows;

        let sx, sy, sw, sh;
        let dx = 0, dy = 0, dw = this.cols, dh = this.rows;

        if (this.fitMode === 'cover') {
          if (videoAspect > targetAspect) {
            sh = vh;
            sw = vh * targetAspect;
          } else {
            sw = vw;
            sh = vw / targetAspect;
          }

          // Zoom
          sw /= this.zoom;
          sh /= this.zoom;

          // Center result
          sx = (vw - sw) / 2;
          sy = (vh - sh) / 2;

          this.offscreenCtx.drawImage(this.video, sx, sy, sw, sh, 0, 0, this.cols, this.rows);
        } else {
          if (videoAspect > targetAspect) {
            dw = this.cols;
            dh = this.cols / videoAspect;
          } else {
            dh = this.rows;
            dw = this.rows * videoAspect;
          }

          // Zoom
          dw *= this.zoom;
          dh *= this.zoom;

          // Center result
          dx = (this.cols - dw) / 2;
          dy = (this.rows - dh) / 2;

          this.offscreenCtx.drawImage(this.video, 0, 0, vw, vh, dx, dy, dw, dh);
        }

        const frameData = this.offscreenCtx.getImageData(0, 0, this.cols, this.rows).data;

        for (let y = 0; y < this.rows; y++) {
          for (let x = 0; x < this.cols; x++) {
            const i = (y * this.cols + x) * 4;
            const r = frameData[i];
            const g = frameData[i + 1];
            const b = frameData[i + 2];

            const lumi = 0.299 * r + 0.587 * g + 0.114 * b;

            let typeIndex = 0;
            if (this.thresholds && this.thresholds.length > 0) {
              // Custom ranges
              typeIndex = this.thresholds.length;
              for (let t = 0; t < this.thresholds.length; t++) {
                if (lumi < this.thresholds[t]) {
                  typeIndex = t;
                  break;
                }
              }
            } else {
              // Default linear mapping
              typeIndex = Math.floor((lumi / 256) * this.tileTypes);
            }

            if (this.invert) {
              const maxIndex = (this.thresholds && this.thresholds.length > 0) ? this.thresholds.length : this.tileTypes - 1;
              typeIndex = maxIndex - typeIndex;
            }

            // Gap Fix: Integer Math
            const xPos = Math.floor(x * (width / this.cols));
            const yPos = Math.floor(y * (height / this.rows));
            const nextX = Math.floor((x + 1) * (width / this.cols));
            const nextY = Math.floor((y + 1) * (height / this.rows));

            if (this.skin === 'minesweeper') {
              this.drawMinesweeperTile(this.renderCtx, xPos, yPos, nextX - xPos, nextY - yPos, typeIndex);
            } else {
              this.drawDefaultTile(this.renderCtx, xPos, yPos, nextX - xPos, nextY - yPos, typeIndex);
            }
          }
        }
      }
    }

    ctx.drawImage(this.renderCanvas, 0, 0);
  }

  // Original Logic renamed
  private drawDefaultTile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, type: number) {
    const size = Math.min(w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = x + w / 2;
    const cy = y + h / 2 + (size * 0.05);

    const fontSize = size * 0.6;
    ctx.font = `bold ${fontSize}px ${this.fontFamily}`;

    switch (type) {
      case 0:
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#333333';
        ctx.font = `bold ${size * 1.2}px sans-serif`;
        ctx.fillText('*', cx, cy + (size * 0.25));
        break;
      case 1:
        ctx.fillStyle = '#bbbbbb';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#111111';
        const char = Math.abs(Math.sin(cx * cy)) > 0.5 ? '1' : '0';
        ctx.fillText(char, cx, cy);
        break;
      case 2:
        ctx.fillStyle = '#EEEE00';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#000000';
        const plusThick = size * 0.085;
        const plusLen = size * 0.45;
        const centerY = y + h / 2;
        ctx.fillRect(cx - plusThick / 2, centerY - plusLen / 2, plusThick, plusLen);
        ctx.fillRect(cx - plusLen / 2, centerY - plusThick / 2, plusLen, plusThick);
        break;
      case 3:
        ctx.fillStyle = '#0000ee';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('0', cx, cy);
        break;
      case 4:
        ctx.fillStyle = '#E0E0E0';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#000000';
        ctx.fillText('1', cx, cy);
        break;
    }
  }

  private drawMinesweeperTile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, type: number) {
    const size = Math.min(w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;

    // Common Bevel Helper (3D effect)
    const drawBevel = (pressed: boolean) => {
      const border = Math.max(2, size * 0.1);

      ctx.fillStyle = '#c0c0c0'; // Base Grey
      ctx.fillRect(x, y, w, h);

      if (!pressed) {
        // Light (Top/Left)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w - border, y + border);
        ctx.lineTo(x + border, y + border);
        ctx.lineTo(x + border, y + h - border);
        ctx.fill();

        // Dark (Bottom/Right)
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.moveTo(x + w, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + border, y + h - border);
        ctx.lineTo(x + w - border, y + h - border);
        ctx.lineTo(x + w - border, y + border);
        ctx.fill();
      } else {
        // Pressed/Flat usually has 1px dark border
        ctx.strokeStyle = '#808080';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
      }
    };

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${size * 0.8}px ${this.fontFamily}`; // Serif looks more retro/minesweeper

    switch (type) {
      case 0: // Number 3-5 (Darkest)
        drawBevel(true);
        // Randomize 3, 4, 5
        const n0 = 3 + Math.floor(Math.abs(Math.sin(cx * cy)) * 3); // 3, 4, 5
        ctx.fillStyle = n0 === 3 ? '#FF0000' : (n0 === 4 ? '#000080' : '#800000');
        ctx.fillText(n0.toString(), cx, cy);
        break;

      case 1: // Flag (Dark)
        drawBevel(false); // Unclicked (Raised)
        // Draw Flag
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.1, cy - size * 0.2);
        ctx.lineTo(cx + size * 0.2, cy - size * 0.05);
        ctx.lineTo(cx - size * 0.1, cy + size * 0.1);
        ctx.fill();
        // Pole
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = size * 0.05;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.1, cy - size * 0.2);
        ctx.lineTo(cx - size * 0.1, cy + size * 0.2);
        ctx.stroke();
        // Base
        ctx.fillRect(cx - size * 0.2, cy + size * 0.2, size * 0.3, size * 0.05);
        break;

      case 2: // Bomb (Mid)
        drawBevel(true); // Pressed
        // Draw Bomb
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        // Spikes
        ctx.fillRect(cx - size * 0.35, cy - size * 0.05, size * 0.7, size * 0.1);
        ctx.fillRect(cx - size * 0.05, cy - size * 0.35, size * 0.1, size * 0.7);
        // Highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - size * 0.1, cy - size * 0.1, size * 0.05, size * 0.05);
        break;

      case 3: // Number 1-2 (Light)
        drawBevel(true);
        const n3 = 1 + Math.floor(Math.abs(Math.cos(cx * cy)) * 2); // 1, 2
        ctx.fillStyle = n3 === 1 ? '#0000FF' : '#008000';
        ctx.fillText(n3.toString(), cx, cy);
        break;

      case 4: // Empty/Unclicked (Brightest)
        drawBevel(false); // Unclicked
        break;
    }
  }
}
