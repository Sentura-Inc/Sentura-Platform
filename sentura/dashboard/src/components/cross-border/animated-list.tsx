"use client";

import {
  Children,
  type KeyboardEvent,
  type ReactNode,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useInView, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  itemClassName?: string;
  showGradients?: boolean;
  displayScrollbar?: boolean;
  scrollable?: boolean;
  enableArrowNavigation?: boolean;
  initialSelectedIndex?: number;
  onItemSelect?: (index: number) => void;
  ariaLabel?: string;
}

interface AnimatedListItemProps {
  children: ReactNode;
  index: number;
  className?: string;
  selected?: boolean;
  onMouseEnter?: () => void;
  onClick?: () => void;
}

const tableRowBaseClass =
  "border-b border-[var(--sentura-border)]/80 transition-colors hover:bg-[var(--sentura-ice)]/42 has-aria-expanded:bg-[var(--sentura-ice)]/42 data-[state=selected]:bg-[var(--sentura-ice)]/60";

function staggerDelay(index: number) {
  return Math.min(index * 0.025, 0.14);
}

function AnimatedListItem({
  children,
  index,
  className,
  selected,
  onMouseEnter,
  onClick,
}: AnimatedListItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.34, once: false });
  const reducedMotion = useReducedMotion();
  const visible = reducedMotion || inView;

  return (
    <motion.div
      ref={ref}
      data-animated-list-index={index}
      data-selected={selected ? "true" : undefined}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={reducedMotion ? "visible" : "hidden"}
      animate={visible ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: 10, scale: 0.985 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      transition={{ duration: 0.22, delay: reducedMotion ? 0 : staggerDelay(index), ease: "easeOut" }}
      className={cn("will-change-transform", selected && "rounded-md ring-1 ring-[var(--sentura-blue)]/30", className)}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedList({
  children,
  className,
  viewportClassName,
  itemClassName,
  showGradients = false,
  displayScrollbar = true,
  scrollable = true,
  enableArrowNavigation = false,
  initialSelectedIndex = -1,
  onItemSelect,
  ariaLabel,
}: AnimatedListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(0);
  const gradientFrameRef = useRef<number | null>(null);
  const items = useMemo(() => Children.toArray(children).filter(Boolean), [children]);

  const updateGradientOpacity = useCallback(() => {
    if (!showGradients) return;

    const container = listRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    const hasOverflow = scrollHeight > clientHeight + 1;
    const nextTopOpacity = hasOverflow ? Math.min(scrollTop / 44, 1) : 0;
    const nextBottomOpacity = hasOverflow ? Math.min(bottomDistance / 44, 1) : 0;

    setTopGradientOpacity((current) => (Math.abs(current - nextTopOpacity) < 0.01 ? current : nextTopOpacity));
    setBottomGradientOpacity((current) => (Math.abs(current - nextBottomOpacity) < 0.01 ? current : nextBottomOpacity));
  }, [showGradients]);

  const scheduleGradientOpacityUpdate = useCallback(() => {
    if (!showGradients || gradientFrameRef.current !== null) return;

    gradientFrameRef.current = window.requestAnimationFrame(() => {
      gradientFrameRef.current = null;
      updateGradientOpacity();
    });
  }, [showGradients, updateGradientOpacity]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateGradientOpacity);
    return () => {
      window.cancelAnimationFrame(frame);
      if (gradientFrameRef.current !== null) {
        window.cancelAnimationFrame(gradientFrameRef.current);
        gradientFrameRef.current = null;
      }
    };
  }, [items.length, updateGradientOpacity]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(updateGradientOpacity);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [updateGradientOpacity]);

  const selectItem = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      onItemSelect?.(index);
    },
    [onItemSelect],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!enableArrowNavigation || items.length === 0) return;

      if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
        event.preventDefault();
        setSelectedIndex((value) => Math.min(value + 1, items.length - 1));
      } else if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
        event.preventDefault();
        setSelectedIndex((value) => Math.max(value - 1, 0));
      } else if (event.key === "Enter" && selectedIndex >= 0) {
        event.preventDefault();
        onItemSelect?.(selectedIndex);
      }
    },
    [enableArrowNavigation, items.length, onItemSelect, selectedIndex],
  );

  useEffect(() => {
    if (!enableArrowNavigation || selectedIndex < 0) return;

    const container = listRef.current;
    const selectedItem = container?.querySelector<HTMLElement>(`[data-animated-list-index="${selectedIndex}"]`);
    selectedItem?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [enableArrowNavigation, selectedIndex]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={listRef}
        aria-label={ariaLabel}
        tabIndex={enableArrowNavigation ? 0 : undefined}
        onScroll={scheduleGradientOpacityUpdate}
        onKeyDown={handleKeyDown}
        className={cn(
          scrollable ? "overflow-y-auto" : "overflow-visible",
          scrollable && displayScrollbar
            ? "[scrollbar-color:rgba(15,114,168,0.38)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--sentura-blue)]/28 [&::-webkit-scrollbar-track]:bg-transparent"
            : scrollable
              ? "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : undefined,
          viewportClassName,
        )}
      >
        {items.map((child, index) => (
          <AnimatedListItem
            key={isValidElement(child) && child.key != null ? child.key : index}
            index={index}
            selected={enableArrowNavigation && selectedIndex === index}
            className={itemClassName}
            onMouseEnter={enableArrowNavigation ? () => setSelectedIndex(index) : undefined}
            onClick={onItemSelect ? () => selectItem(index) : undefined}
          >
            {child}
          </AnimatedListItem>
        ))}
      </div>
      {showGradients ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-t-md bg-gradient-to-b from-background to-transparent transition-opacity duration-300"
            style={{ opacity: topGradientOpacity }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-md bg-gradient-to-t from-background to-transparent transition-opacity duration-300"
            style={{ opacity: bottomGradientOpacity }}
          />
        </>
      ) : null}
    </div>
  );
}

type AnimatedTableRowProps = HTMLMotionProps<"tr"> & {
  index?: number;
  preserveTableRowBase?: boolean;
};

export function AnimatedTableRow({
  index = 0,
  preserveTableRowBase = true,
  className,
  children,
  ...props
}: AnimatedTableRowProps) {
  const ref = useRef<HTMLTableRowElement>(null);
  const inView = useInView(ref, { amount: 0.28, once: false });
  const reducedMotion = useReducedMotion();
  const visible = reducedMotion || inView;

  return (
    <motion.tr
      ref={ref}
      data-animated-list-index={index}
      initial={reducedMotion ? "visible" : "hidden"}
      animate={visible ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.2, delay: reducedMotion ? 0 : staggerDelay(index), ease: "easeOut" }}
      className={cn(preserveTableRowBase && tableRowBaseClass, className)}
      {...props}
    >
      {children}
    </motion.tr>
  );
}
