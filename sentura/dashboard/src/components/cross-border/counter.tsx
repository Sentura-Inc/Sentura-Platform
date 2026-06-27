"use client";

import { useEffect, type CSSProperties } from "react";
import { motion, useSpring, useTransform, type MotionValue } from "motion/react";

type CounterPlace = number | ".";

interface NumberGlyphProps {
  mv: MotionValue<number>;
  number: number;
  height: number;
}

interface DigitProps {
  place: CounterPlace;
  value: number;
  height: number;
  digitStyle?: CSSProperties;
}

interface CounterProps {
  value: number;
  fontSize?: number;
  padding?: number;
  places?: readonly CounterPlace[];
  gap?: number;
  borderRadius?: number;
  horizontalPadding?: number;
  textColor?: string;
  fontWeight?: CSSProperties["fontWeight"];
  containerStyle?: CSSProperties;
  counterStyle?: CSSProperties;
  digitStyle?: CSSProperties;
  gradientHeight?: number;
  gradientFrom?: string;
  gradientTo?: string;
  topGradientStyle?: CSSProperties;
  bottomGradientStyle?: CSSProperties;
}

function NumberGlyph({ mv, number, height }: NumberGlyphProps) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * height;
    if (offset > 5) {
      memo -= 10 * height;
    }
    return memo;
  });

  return (
    <motion.span
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        y,
      }}
    >
      {number}
    </motion.span>
  );
}

function normalizeNearInteger(num: number) {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getValueRoundedToPlace(value: number, place: number) {
  const scaled = value / place;
  return Math.floor(normalizeNearInteger(scaled));
}

function placesFromValue(value: number): CounterPlace[] {
  const safeValue = Number.isFinite(value) ? value : 0;
  const valueText = String(safeValue);
  const decimalIndex = valueText.indexOf(".");

  return [...valueText].map((ch, index, chars) => {
    if (ch === ".") return ".";
    if (decimalIndex === -1) {
      return 10 ** (chars.length - index - 1);
    }
    return index < decimalIndex
      ? 10 ** (decimalIndex - index - 1)
      : 10 ** -(index - decimalIndex);
  });
}

function Digit({ place, value, height, digitStyle }: DigitProps) {
  const isDecimal = place === ".";
  const valueRoundedToPlace = isDecimal ? 0 : getValueRoundedToPlace(value, place);
  const animatedValue = useSpring(valueRoundedToPlace);

  useEffect(() => {
    if (!isDecimal) {
      animatedValue.set(valueRoundedToPlace);
    }
  }, [animatedValue, valueRoundedToPlace, isDecimal]);

  if (isDecimal) {
    return (
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "fit-content",
          height,
          fontVariantNumeric: "tabular-nums",
          ...digitStyle,
        }}
      >
        .
      </span>
    );
  }

  return (
    <span
      style={{
        position: "relative",
        width: "1ch",
        height,
        fontVariantNumeric: "tabular-nums",
        ...digitStyle,
      }}
    >
      {Array.from({ length: 10 }, (_, index) => (
        <NumberGlyph key={index} mv={animatedValue} number={index} height={height} />
      ))}
    </span>
  );
}

export function Counter({
  value,
  fontSize = 100,
  padding = 0,
  places,
  gap = 8,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = "inherit",
  fontWeight = "inherit",
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = "black",
  gradientTo = "transparent",
  topGradientStyle,
  bottomGradientStyle,
}: CounterProps) {
  const height = fontSize + padding;
  const resolvedPlaces = places ?? placesFromValue(value);

  return (
    <span style={{ position: "relative", display: "inline-block", ...containerStyle }}>
      <span
        style={{
          display: "flex",
          overflow: "hidden",
          lineHeight: 1,
          gap,
          borderRadius,
          paddingLeft: horizontalPadding,
          paddingRight: horizontalPadding,
          color: textColor,
          fontSize,
          fontWeight,
          direction: "ltr",
          ...counterStyle,
        }}
      >
        {resolvedPlaces.map((place, index) => (
          <Digit
            key={`${String(place)}-${index}`}
            place={place}
            value={value}
            height={height}
            digitStyle={digitStyle}
          />
        ))}
      </span>
      <span
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 0,
            width: "100%",
            height: gradientHeight,
            background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
            ...topGradientStyle,
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: 0,
            width: "100%",
            height: gradientHeight,
            background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
            ...bottomGradientStyle,
          }}
        />
      </span>
    </span>
  );
}
