"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText as GSAPSplitText } from "gsap/SplitText";
import { motion, useAnimationFrame, useMotionValue, useTransform, type MotionStyle } from "motion/react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);

const LOGIN_GREETING_TEXT = "Hi！欢迎使用";

type SplitTextTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";
type SplitType = "chars" | "words" | "lines" | "words, chars";
type SplitTextElement = HTMLElement & { _rbsplitInstance?: GSAPSplitText | null };

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  ease?: string;
  splitType?: SplitType;
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  threshold?: number;
  rootMargin?: string;
  textAlign?: CSSProperties["textAlign"];
  tag?: SplitTextTag;
  onLetterAnimationComplete?: () => void;
}

function SplitText({
  text,
  className = "",
  delay = 50,
  duration = 1.25,
  ease = "power3.out",
  splitType = "chars",
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = "-100px",
  textAlign = "center",
  tag = "p",
  onLetterAnimationComplete,
}: SplitTextProps) {
  const ref = useRef<SplitTextElement | null>(null);
  const animationCompletedRef = useRef(false);
  const onCompleteRef = useRef(onLetterAnimationComplete);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete;
  }, [onLetterAnimationComplete]);

  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts || fonts.status === "loaded") {
      const frame = window.requestAnimationFrame(() => setFontsLoaded(true));
      return () => window.cancelAnimationFrame(frame);
    }

    let cancelled = false;
    fonts.ready.then(() => {
      if (!cancelled) setFontsLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => setPrefersReducedMotion(media.matches);

    media.addEventListener("change", syncReducedMotion);

    return () => media.removeEventListener("change", syncReducedMotion);
  }, []);

  const setElementRef = useCallback((node: HTMLElement | null) => {
    ref.current = node as SplitTextElement | null;
  }, []);

  useGSAP(
    () => {
      if (!ref.current || !text) return;

      const el = ref.current;

      if (prefersReducedMotion) {
        gsap.set(el, { opacity: 1, y: 0 });
        if (!animationCompletedRef.current) {
          animationCompletedRef.current = true;
          onCompleteRef.current?.();
        }
        return;
      }

      if (!fontsLoaded || animationCompletedRef.current) return;

      if (el._rbsplitInstance) {
        try {
          el._rbsplitInstance.revert();
        } catch {
          // GSAP can throw if the split was already reverted during a fast remount.
        }
        el._rbsplitInstance = null;
      }

      const startPct = (1 - threshold) * 100;
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
      const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
      const marginUnit = marginMatch ? marginMatch[2] || "px" : "px";
      const sign =
        marginValue === 0
          ? ""
          : marginValue < 0
            ? `-=${Math.abs(marginValue)}${marginUnit}`
            : `+=${marginValue}${marginUnit}`;
      const start = `top ${startPct}%${sign}`;

      let targets: Element[] = [];
      const assignTargets = (self: GSAPSplitText) => {
        if (splitType.includes("chars") && self.chars.length) targets = self.chars;
        if (!targets.length && splitType.includes("words") && self.words.length) targets = self.words;
        if (!targets.length && splitType.includes("lines") && self.lines.length) targets = self.lines;
        if (!targets.length) targets = self.chars.length ? self.chars : self.words.length ? self.words : self.lines;
      };

      let completionFallback: number | null = null;
      const finishAnimation = () => {
        if (completionFallback !== null) {
          window.clearTimeout(completionFallback);
          completionFallback = null;
        }
        if (!animationCompletedRef.current) {
          gsap.set(targets, { ...to });
          animationCompletedRef.current = true;
          onCompleteRef.current?.();
        }
      };

      const splitInstance = new GSAPSplitText(el, {
        type: splitType,
        smartWrap: true,
        autoSplit: splitType === "lines",
        linesClass: "split-line",
        wordsClass: "split-word",
        charsClass: "split-char",
        reduceWhiteSpace: false,
        onSplit: (self) => {
          assignTargets(self);
          completionFallback = window.setTimeout(
            finishAnimation,
            (duration + (delay / 1000) * Math.max(targets.length - 1, 0) + 0.28) * 1000,
          );

          return gsap.fromTo(
            targets,
            { ...from },
            {
              ...to,
              duration,
              ease,
              stagger: delay / 1000,
              scrollTrigger: {
                trigger: el,
                start,
                once: true,
                fastScrollEnd: true,
                anticipatePin: 0.4,
              },
              onComplete: finishAnimation,
              willChange: "transform, opacity",
              force3D: true,
            },
          );
        },
      });

      el._rbsplitInstance = splitInstance;

      return () => {
        if (completionFallback !== null) window.clearTimeout(completionFallback);
        ScrollTrigger.getAll().forEach((trigger) => {
          if (trigger.trigger === el) trigger.kill();
        });
        try {
          splitInstance.revert();
        } catch {
          // The instance may already be reverted by GSAP when autoSplit refreshes.
        }
        el._rbsplitInstance = null;
      };
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        fontsLoaded,
        prefersReducedMotion,
      ],
      scope: ref,
    },
  );

  const style: CSSProperties = {
    textAlign,
    overflow: "hidden",
    display: "inline-block",
    whiteSpace: "normal",
    wordWrap: "break-word",
    willChange: "transform, opacity",
  };

  const elementProps = {
    style,
    className: cn("split-parent", className),
  };

  switch (tag) {
    case "h1":
      return <h1 ref={setElementRef} {...elementProps}>{text}</h1>;
    case "h2":
      return <h2 ref={setElementRef} {...elementProps}>{text}</h2>;
    case "h3":
      return <h3 ref={setElementRef} {...elementProps}>{text}</h3>;
    case "h4":
      return <h4 ref={setElementRef} {...elementProps}>{text}</h4>;
    case "h5":
      return <h5 ref={setElementRef} {...elementProps}>{text}</h5>;
    case "h6":
      return <h6 ref={setElementRef} {...elementProps}>{text}</h6>;
    case "span":
      return <span ref={setElementRef} {...elementProps}>{text}</span>;
    case "p":
    default:
      return <p ref={setElementRef} {...elementProps}>{text}</p>;
  }
}

interface ShinyTextProps {
  text: string;
  color?: string;
  shineColor?: string;
  speed?: number;
  delay?: number;
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: "left" | "right";
  disabled?: boolean;
  className?: string;
}

function ShinyText({
  text,
  disabled = false,
  speed = 2,
  className = "",
  color = "var(--sentura-blue)",
  shineColor = "var(--sentura-blue-hover)",
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = "left",
  delay = 0,
}: ShinyTextProps) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const directionRef = useRef(direction === "left" ? 1 : -1);

  const animationDuration = speed * 1000;
  const delayDuration = delay * 1000;

  useAnimationFrame((time) => {
    if (disabled || isPaused) {
      lastTimeRef.current = null;
      return;
    }

    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    if (yoyo) {
      const cycleDuration = animationDuration + delayDuration;
      const fullCycle = cycleDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;

      if (cycleTime < animationDuration) {
        const nextProgress = (cycleTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? nextProgress : 100 - nextProgress);
      } else if (cycleTime < cycleDuration) {
        progress.set(directionRef.current === 1 ? 100 : 0);
      } else if (cycleTime < cycleDuration + animationDuration) {
        const reverseTime = cycleTime - cycleDuration;
        const nextProgress = 100 - (reverseTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? nextProgress : 100 - nextProgress);
      } else {
        progress.set(directionRef.current === 1 ? 0 : 100);
      }
      return;
    }

    const cycleDuration = animationDuration + delayDuration;
    const cycleTime = elapsedRef.current % cycleDuration;

    if (cycleTime < animationDuration) {
      const nextProgress = (cycleTime / animationDuration) * 100;
      progress.set(directionRef.current === 1 ? nextProgress : 100 - nextProgress);
    } else {
      progress.set(directionRef.current === 1 ? 100 : 0);
    }
  });

  useEffect(() => {
    directionRef.current = direction === "left" ? 1 : -1;
    elapsedRef.current = 0;
    progress.set(0);
  }, [direction, progress]);

  const backgroundPosition = useTransform(progress, (value) => `${150 - value * 2}% center`);

  const gradientStyle: MotionStyle = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 34%, ${shineColor} 50%, ${color} 66%, ${color} 100%)`,
    backgroundSize: "200% auto",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundPosition,
  };

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  return (
    <motion.span
      className={cn("inline-block", className)}
      style={gradientStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </motion.span>
  );
}

export function AnimatedLoginGreeting({ className }: { className?: string }) {
  const [shineActive, setShineActive] = useState(false);

  const activateShine = useCallback(() => {
    setShineActive(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(activateShine, 1240);
    return () => window.clearTimeout(timer);
  }, [activateShine]);

  return (
    <>
      <span className="sr-only">{LOGIN_GREETING_TEXT}</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-grid min-w-[7.45em] max-w-full place-items-center whitespace-nowrap align-baseline",
          className,
        )}
      >
        <SplitText
          text={LOGIN_GREETING_TEXT}
          tag="span"
          className={cn(
            "col-start-1 row-start-1 block text-[#0f72a8]",
            shineActive ? "opacity-0" : "opacity-100",
          )}
          delay={54}
          duration={0.58}
          ease="back.out(1.65)"
          splitType="chars"
          from={{ opacity: 0, y: 26, scale: 0.82, rotateX: -30 }}
          to={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
          threshold={0.1}
          rootMargin="-60px"
          textAlign="center"
          onLetterAnimationComplete={activateShine}
        />
        <span
          className={cn(
            "col-start-1 row-start-1 block",
            shineActive ? "opacity-100" : "opacity-0",
          )}
        >
          <ShinyText
            text={LOGIN_GREETING_TEXT}
            disabled={!shineActive}
            speed={2}
            delay={0}
            spread={120}
            direction="left"
            yoyo={false}
            pauseOnHover={false}
            color="#0f72a8"
            shineColor="#ffffff"
            className="drop-shadow-[0_10px_26px_rgba(43,77,208,0.18)]"
          />
        </span>
      </span>
    </>
  );
}
