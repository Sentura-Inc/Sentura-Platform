"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

class Pixel {
  private width: number;
  private height: number;
  private ctx: CanvasRenderingContext2D;
  private x: number;
  private y: number;
  private color: string;
  private speed: number;
  private size = 0;
  private sizeStep = Math.random() * 0.4;
  private minSize = 0.5;
  private maxSizeInteger = 2;
  private maxSize: number;
  private delay: number;
  private counter = 0;
  private counterStep: number;
  isIdle = false;
  private isReverse = false;
  private isShimmer = false;

  constructor(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number,
  ) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.randomBetween(0.1, 0.9) * speed;
    this.maxSize = this.randomBetween(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01;
  }

  private randomBetween(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  private draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  appear() {
    this.isIdle = false;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) {
      this.isShimmer = true;
    }
    if (this.isShimmer) {
      this.shimmer();
    } else {
      this.size += this.sizeStep;
    }
    this.draw();
  }

  disappear() {
    this.isShimmer = false;
    this.counter = 0;
    if (this.size <= 0) {
      this.isIdle = true;
      return;
    }
    this.size -= 0.1;
    this.draw();
  }

  private shimmer() {
    if (this.size >= this.maxSize) {
      this.isReverse = true;
    } else if (this.size <= this.minSize) {
      this.isReverse = false;
    }
    this.size += this.isReverse ? -this.speed : this.speed;
  }
}

const VARIANTS = {
  default: {
    activeColor: null,
    gap: 5,
    speed: 35,
    colors: "#f8fafc,#f1f5f9,#cbd5e1",
    noFocus: false,
  },
  blue: {
    activeColor: "#e0f2fe",
    gap: 10,
    speed: 25,
    colors: "#e0f2fe,#7dd3fc,#0ea5e9",
    noFocus: false,
  },
  yellow: {
    activeColor: "#fef08a",
    gap: 3,
    speed: 20,
    colors: "#fef08a,#fde047,#eab308",
    noFocus: false,
  },
  pink: {
    activeColor: "#fecdd3",
    gap: 6,
    speed: 80,
    colors: "#fecdd3,#fda4af,#e11d48",
    noFocus: true,
  },
} as const;

type PixelCardVariant = keyof typeof VARIANTS;

interface PixelCardProps {
  variant?: PixelCardVariant;
  gap?: number;
  speed?: number;
  colors?: string;
  noFocus?: boolean;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

function getEffectiveSpeed(value: number, reducedMotion: boolean) {
  const min = 0;
  const max = 100;
  const throttle = 0.001;
  if (value <= min || reducedMotion) return min;
  if (value >= max) return max * throttle;
  return value * throttle;
}

export function PixelCard({
  variant = "default",
  gap,
  speed,
  colors,
  noFocus,
  className,
  contentClassName,
  style,
  children,
}: PixelCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const animationRef = useRef<number | null>(null);
  const previousTimeRef = useRef(0);
  const reducedMotionRef = useRef(false);

  const variantCfg = VARIANTS[variant] ?? VARIANTS.default;
  const finalGap = gap ?? variantCfg.gap;
  const finalSpeed = speed ?? variantCfg.speed;
  const finalColors = colors ?? variantCfg.colors;
  const finalNoFocus = noFocus ?? variantCfg.noFocus;

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const initPixels = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx || width <= 0 || height <= 0) return;

    canvasRef.current.width = width;
    canvasRef.current.height = height;
    canvasRef.current.style.width = `${width}px`;
    canvasRef.current.style.height = `${height}px`;

    const colorsArray = finalColors.split(",").map((color) => color.trim()).filter(Boolean);
    const pixels: Pixel[] = [];
    for (let x = 0; x < width; x += finalGap) {
      for (let y = 0; y < height; y += finalGap) {
        const color = colorsArray[Math.floor(Math.random() * colorsArray.length)] ?? "#e0f2fe";
        const dx = x - width / 2;
        const dy = y - height / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const delay = reducedMotionRef.current ? 0 : distance;
        pixels.push(
          new Pixel(
            canvasRef.current,
            ctx,
            x,
            y,
            color,
            getEffectiveSpeed(finalSpeed, reducedMotionRef.current),
            delay,
          ),
        );
      }
    }
    pixelsRef.current = pixels;
  }, [finalColors, finalGap, finalSpeed]);

  const animate = useCallback((methodName: "appear" | "disappear") => {
    animationRef.current = requestAnimationFrame(() => animate(methodName));
    const now = performance.now();
    const elapsed = now - previousTimeRef.current;
    const frameInterval = 1000 / 60;
    if (elapsed < frameInterval) return;
    previousTimeRef.current = now - (elapsed % frameInterval);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let allIdle = true;
    for (const pixel of pixelsRef.current) {
      pixel[methodName]();
      if (!pixel.isIdle) allIdle = false;
    }
    if (allIdle) stopAnimation();
  }, [stopAnimation]);

  const handleAnimation = useCallback((methodName: "appear" | "disappear") => {
    stopAnimation();
    previousTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(() => animate(methodName));
  }, [animate, stopAnimation]);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    initPixels();
    const observer = new ResizeObserver(() => {
      stopAnimation();
      initPixels();
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      stopAnimation();
    };
  }, [initPixels, stopAnimation]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "group/pixel-card relative isolate overflow-hidden rounded-lg border border-sky-200/80 bg-white/44 shadow-[0_30px_88px_-62px_rgba(14,165,233,0.68)] transition-colors duration-200",
        className,
      )}
      style={style}
      onMouseEnter={() => handleAnimation("appear")}
      onMouseLeave={() => handleAnimation("disappear")}
      onFocus={finalNoFocus ? undefined : (event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        handleAnimation("appear");
      }}
      onBlur={finalNoFocus ? undefined : (event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        handleAnimation("disappear");
      }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-0 block h-full w-full"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-700 group-hover/pixel-card:opacity-100 group-focus-within/pixel-card:opacity-100"
        style={{
          background: `radial-gradient(circle at 50% 42%, ${variantCfg.activeColor ?? "rgba(224,242,254,0.82)"}, transparent 72%)`,
        }}
        aria-hidden="true"
      />
      <div className={cn("relative z-10", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
