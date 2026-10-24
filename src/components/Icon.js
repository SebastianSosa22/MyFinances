import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

// Íconos de línea (estilo Feather) dibujados con SVG para que se vean igual en iPhone, Android y web
const PATHS = {
  eye: [<Path key="a" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />, <Circle key="b" cx="12" cy="12" r="3" />],
  eyeOff: [
    <Path key="a" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />,
    <Line key="b" x1="1" y1="1" x2="23" y2="23" />,
  ],
  bell: [<Path key="a" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />, <Path key="b" d="M13.73 21a2 2 0 0 1-3.46 0" />],
  chevron: [<Path key="a" d="M9 18l6-6-6-6" />],
  chevronLeft: [<Path key="a" d="M15 18l-6-6 6-6" />],
  chevronDown: [<Path key="a" d="M6 9l6 6 6-6" />],
  chevronUp: [<Path key="a" d="M18 15l-6-6-6 6" />],
  home: [<Path key="a" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />, <Path key="b" d="M9 22V12h6v10" />],
  list: [<Path key="a" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />, <Path key="b" d="M14 2v6h6" />, <Line key="c" x1="16" y1="13" x2="8" y2="13" />, <Line key="d" x1="16" y1="17" x2="8" y2="17" />],
  pie: [<Path key="a" d="M21.21 15.89A10 10 0 1 1 8 2.83" />, <Path key="b" d="M22 12A10 10 0 0 0 12 2v10z" />],
  bag: [<Path key="a" d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />, <Line key="b" x1="3" y1="6" x2="21" y2="6" />, <Path key="c" d="M16 10a4 4 0 0 1-8 0" />],
  target: [<Circle key="a" cx="12" cy="12" r="10" />, <Circle key="b" cx="12" cy="12" r="6" />, <Circle key="c" cx="12" cy="12" r="2" />],
  search: [<Circle key="a" cx="11" cy="11" r="8" />, <Line key="b" x1="21" y1="21" x2="16.65" y2="16.65" />],
  filter: [<Path key="a" d="M22 3H2l8 9.46V19l4 2v-8.54z" />],
  calendar: [<Rect key="a" x="3" y="4" width="18" height="18" rx="2" />, <Line key="b" x1="16" y1="2" x2="16" y2="6" />, <Line key="c" x1="8" y1="2" x2="8" y2="6" />, <Line key="d" x1="3" y1="10" x2="21" y2="10" />],
  x: [<Line key="a" x1="18" y1="6" x2="6" y2="18" />, <Line key="b" x1="6" y1="6" x2="18" y2="18" />],
};

export function Icon({ name, size = 22, color = '#fff', width = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </Svg>
  );
}
