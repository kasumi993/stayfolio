import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { color as themeColor } from './theme';

/** A small hand-drawn icon set: 24×24 grid, 2px round strokes. */
const shapes = {
  plus: (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  minus: <Line x1="5" y1="12" x2="19" y2="12" />,
  list: (
    <>
      <Line x1="9" y1="6" x2="20" y2="6" />
      <Line x1="9" y1="12" x2="20" y2="12" />
      <Line x1="9" y1="18" x2="20" y2="18" />
      <Circle cx="4.5" cy="6" r="1" />
      <Circle cx="4.5" cy="12" r="1" />
      <Circle cx="4.5" cy="18" r="1" />
    </>
  ),
  users: (
    <>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <Path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4c1.9.8 3 2.8 3 5.6" />
    </>
  ),
  building: (
    <>
      <Path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V21" />
      <Path d="M15 10h3.5a1.5 1.5 0 0 1 1.5 1.5V21" />
      <Line x1="2.5" y1="21" x2="21.5" y2="21" />
      <Line x1="8" y1="8.5" x2="11" y2="8.5" />
      <Line x1="8" y1="12.5" x2="11" y2="12.5" />
      <Line x1="8" y1="16.5" x2="11" y2="16.5" />
    </>
  ),
  close: (
    <>
      <Line x1="6" y1="6" x2="18" y2="18" />
      <Line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  check: <Polyline points="5,12.5 10,17.5 19,7" />,
  left: <Polyline points="14.5,5 7.5,12 14.5,19" />,
  right: <Polyline points="9.5,5 16.5,12 9.5,19" />,
  down: <Polyline points="5,9 12,16 19,9" />,
  month: (
    <>
      <Rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <Line x1="4" y1="10.5" x2="20" y2="10.5" />
      <Line x1="8.5" y1="3.5" x2="8.5" y2="7" />
      <Line x1="15.5" y1="3.5" x2="15.5" y2="7" />
    </>
  ),
  home: (
    <>
      <Path d="M4 11.2 12 4.5l8 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <Path d="M9.8 20.5v-5.3h4.4v5.3" />
    </>
  ),
  chart: (
    <>
      <Line x1="6" y1="20" x2="6" y2="12.5" />
      <Line x1="12" y1="20" x2="12" y2="5" />
      <Line x1="18" y1="20" x2="18" y2="9.5" />
    </>
  ),
  receipt: (
    <>
      <Path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.5z" />
      <Line x1="9.3" y1="8.5" x2="14.7" y2="8.5" />
      <Line x1="9.3" y1="12.5" x2="14.7" y2="12.5" />
    </>
  ),
  camera: (
    <>
      <Path d="M4 8.5h3.2L8.8 6h6.4l1.6 2.5H20v10.5H4z" />
      <Circle cx="12" cy="13.3" r="3.2" />
    </>
  ),
  image: (
    <>
      <Rect x="4" y="5" width="16" height="14" rx="3" />
      <Circle cx="9" cy="10" r="1.5" />
      <Polyline points="5,17.5 10.5,13 14,15.8 16.5,13.8 19.5,16.5" />
    </>
  ),
  file: (
    <>
      <Path d="M7 3.5h6.5L18 8v12.5H7z" />
      <Polyline points="13.2,3.8 13.2,8.3 17.7,8.3" />
    </>
  ),
  repeat: (
    <>
      <Path d="M5 11V9.5A2.5 2.5 0 0 1 7.5 7H19" />
      <Polyline points="16,4 19,7 16,10" />
      <Path d="M19 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5" />
      <Polyline points="8,20 5,17 8,14" />
    </>
  ),
  share: (
    <>
      <Path d="M12 15V4" />
      <Polyline points="8,7.5 12,3.5 16,7.5" />
      <Path d="M6 12v7.5h12V12" />
    </>
  ),
  gear: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </>
  ),
  trash: (
    <>
      <Line x1="5" y1="7" x2="19" y2="7" />
      <Path d="M9.5 7V4.5h5V7M7 7l.8 13h8.4L17 7" />
    </>
  ),
  spark: <Path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2z" />,
  alert: (
    <>
      <Path d="M12 4.2 21 19.5H3z" />
      <Line x1="12" y1="10" x2="12" y2="14" />
      <Line x1="12" y1="16.8" x2="12" y2="16.9" />
    </>
  ),
  eye: (
    <>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  lock: (
    <>
      <Rect x="5.5" y="10.5" width="13" height="10" rx="2.5" />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  link: (
    <>
      <Path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1 1" />
      <Path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1-1" />
    </>
  ),
  download: (
    <>
      <Path d="M12 4v11" />
      <Polyline points="8,11.5 12,15.5 16,11.5" />
      <Line x1="5" y1="20" x2="19" y2="20" />
    </>
  ),
  swap: (
    <>
      <Line x1="4" y1="8.5" x2="19" y2="8.5" />
      <Polyline points="16,5.5 19,8.5 16,11.5" />
      <Line x1="20" y1="15.5" x2="5" y2="15.5" />
      <Polyline points="8,12.5 5,15.5 8,18.5" />
    </>
  ),
  edit: (
    <>
      <Path d="M5 19l.9-3.9L16.2 4.8l3 3L8.9 18.1z" />
      <Line x1="14" y1="7" x2="17" y2="10" />
    </>
  ),
} as const;

export type IconName = keyof typeof shapes;

export function Icon({ name, size = 22, color = themeColor.ink, weight = 2 }: { name: IconName; size?: number; color?: string; weight?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
      {shapes[name]}
    </Svg>
  );
}
