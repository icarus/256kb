
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export function useCanvasRecorder(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [isRecording, setIsRecording] = useState(false);
  const framesRef = useRef<Blob[]>([]);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load FFmpeg
  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }
    const ffmpeg = ffmpegRef.current;
    if (ffmpeg.loaded) return;

    // Using unpkg urls
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setLoaded(true);
      console.log("FFmpeg loaded");
    } catch (e: any) {
      console.error("FFmpeg load failed:", e);
    }
  };

  const startRecording = useCallback((bitrate: number = 25000000) => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) {
      if (!loaded) alert("Video encoder still loading, please wait...");
      return;
    }

    setIsRecording(true);
    framesRef.current = [];

    const totalDuration = 10000; // 10s
    const fps = 60;
    const interval = 1000 / fps;
    const startTime = performance.now();
    let frameCount = 0;

    console.log("Starting Capture for MP4 generation...");

    const captureFrame = (time: number) => {
      const elapsed = time - startTime;

      if (elapsed >= totalDuration) {
        // Stop & Encode
        encodeVideo(bitrate);
        return;
      }

      // Check if it's time for a new frame (frame 0, 1, 2...)
      // expected time for frame N is N * interval
      // if elapsed >= frameCount * interval, take a snapshot
      if (elapsed >= frameCount * interval) {
        canvas.toBlob((blob) => {
          if (blob) {
            framesRef.current.push(blob);
          }
        }, 'image/png'); // Lossless capture for encoding
        frameCount++;
      }

      requestAnimationFrame(captureFrame);
    };

    const encodeVideo = async (targetBitrate: number) => {
      setIsRecording(true); // Keep UI blocked
      console.log(`Encoding ${framesRef.current.length} frames...`);
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg) return;

      // Write frames to FS
      // We expect filenames like frame001.png
      for (let i = 0; i < framesRef.current.length; i++) {
        const fileData = await fetchFile(framesRef.current[i]);
        await ffmpeg.writeFile(`frame${i.toString().padStart(4, '0')}.png`, fileData);
      }

      console.log("Running ffmpeg...");
      // Bitrate (default 25M)
      // ffmpeg -framerate 60 -pattern_type glob -i '*.png' -c:v libx264 -pix_fmt yuv420p -b:v 25M out.mp4
      // glob not supported in wasm usually, use sequence
      await ffmpeg.exec([
        '-framerate', '60',
        '-i', 'frame%04d.png',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-b:v', `${targetBitrate}`,
        '-preset', 'ultrafast', // Speed up encoding
        'output.mp4'
      ]);

      console.log("Encoding done. Reading output...");
      const data = await ffmpeg.readFile('output.mp4');

      // Cleanup files
      for (let i = 0; i < framesRef.current.length; i++) {
        await ffmpeg.deleteFile(`frame${i.toString().padStart(4, '0')}.png`);
      }
      await ffmpeg.deleteFile('output.mp4');

      const blob = new Blob([(data as Uint8Array).buffer as ArrayBuffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const tag = targetBitrate < 1000000 ? '256kb' : 'hq';
      a.download = `lissajous_10s_${tag}_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

      setIsRecording(false);
      framesRef.current = [];
      console.log("Done.");
    };

    requestAnimationFrame(captureFrame);

  }, [canvasRef, loaded]);

  return { isRecording, startRecording };
}
