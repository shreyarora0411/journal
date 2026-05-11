import Svg, { Line, Path } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
};

/**
 * Open-book illustration used on the Promise onboarding screen (#03).
 * Two facing pages on ruled lines, with a terracotta bookmark on the right page.
 * Stroke colours match the design-pack reference (1.2px ink lines, brand-color fill).
 */
export function OpenBookMark({ width = 180, height = 154 }: Props) {
  return (
    <Svg viewBox="0 0 140 120" width={width} height={height} fill="none">
      {/* Left page */}
      <Path
        d="M70 22 C 60 20, 30 20, 12 24 L 12 104 C 30 100, 60 100, 70 102 L 70 22 Z"
        stroke="#1A1A1A"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#FAF8F3"
      />
      {/* Right page */}
      <Path
        d="M70 22 C 80 20, 110 20, 128 24 L 128 104 C 110 100, 80 100, 70 102 L 70 22 Z"
        stroke="#1A1A1A"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#FAF8F3"
      />
      {/* Spine */}
      <Line x1="70" y1="22" x2="70" y2="102" stroke="#1A1A1A" strokeWidth={1.2} />
      {/* Ruled lines — left page */}
      <Line
        x1="22"
        y1="38"
        x2="62"
        y2="35"
        stroke="#1A1A1A"
        strokeWidth={0.8}
        strokeOpacity={0.55}
      />
      <Line
        x1="22"
        y1="48"
        x2="58"
        y2="45"
        stroke="#1A1A1A"
        strokeWidth={0.8}
        strokeOpacity={0.55}
      />
      <Line
        x1="22"
        y1="58"
        x2="60"
        y2="55"
        stroke="#1A1A1A"
        strokeWidth={0.8}
        strokeOpacity={0.55}
      />
      <Line
        x1="22"
        y1="68"
        x2="50"
        y2="66"
        stroke="#1A1A1A"
        strokeWidth={0.8}
        strokeOpacity={0.55}
      />
      {/* Ruled lines — right page */}
      <Line
        x1="78"
        y1="35"
        x2="118"
        y2="38"
        stroke="#1A1A1A"
        strokeWidth={0.8}
        strokeOpacity={0.55}
      />
      <Line
        x1="82"
        y1="45"
        x2="118"
        y2="48"
        stroke="#1A1A1A"
        strokeWidth={0.8}
        strokeOpacity={0.55}
      />
      <Line
        x1="80"
        y1="55"
        x2="118"
        y2="58"
        stroke="#1A1A1A"
        strokeWidth={0.8}
        strokeOpacity={0.55}
      />
      <Line
        x1="90"
        y1="66"
        x2="118"
        y2="68"
        stroke="#1A1A1A"
        strokeWidth={0.8}
        strokeOpacity={0.55}
      />
      {/* Terracotta bookmark on the right page with V-notch */}
      <Path d="M104 22 L104 42 L99 37 L94 42 L94 22 Z" fill="#993C1D" />
    </Svg>
  );
}
