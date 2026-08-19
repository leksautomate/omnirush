// Hand-drawn, stylized continent/region silhouettes for the HUD map overlay —
// NOT sourced from Natural Earth or any real boundary dataset (each shape is a
// 4-9 point approximation, not per-country coastline data). Good enough for a
// tactical-map aesthetic, not for geographic accuracy.
// Coordinates are on an arbitrary 1000x600 viewBox, not lon/lat.

export interface CountryVectorPath {
  id: string
  name: string
  d: string
  center: [number, number] // [x, y] in 1000x600 viewBox
}

export const WORLD_REGIONS: CountryVectorPath[] = [
  {
    id: 'north-america',
    name: 'North America',
    d: 'M 140,80 L 190,75 L 260,85 L 290,120 L 270,170 L 220,185 L 180,240 L 200,280 L 175,295 L 160,250 L 130,220 L 115,160 L 105,120 Z',
    center: [190, 160]
  },
  {
    id: 'south-america',
    name: 'South America',
    d: 'M 250,305 L 305,320 L 335,370 L 310,460 L 275,530 L 250,540 L 240,480 L 220,380 L 235,320 Z',
    center: [280, 420]
  },
  {
    id: 'europe-uk',
    name: 'United Kingdom & Ireland',
    d: 'M 445,135 L 460,130 L 468,145 L 455,165 L 442,160 Z M 432,145 L 440,140 L 442,155 L 433,158 Z',
    center: [450, 145]
  },
  {
    id: 'europe-west',
    name: 'Western Europe (France, Germany, Low Countries)',
    d: 'M 465,160 L 495,150 L 525,160 L 530,195 L 505,215 L 470,220 L 455,185 Z',
    center: [490, 185]
  },
  {
    id: 'europe-south',
    name: 'Southern Europe (Spain, Italy, Balkans)',
    d: 'M 445,215 L 475,215 L 515,225 L 540,250 L 520,265 L 485,250 L 440,245 Z M 505,230 L 518,255 L 505,270 L 498,250 Z',
    center: [480, 240]
  },
  {
    id: 'europe-east-russia',
    name: 'Eastern Europe & Russia',
    d: 'M 525,115 L 620,100 L 780,95 L 840,130 L 760,190 L 640,185 L 560,165 L 525,140 Z',
    center: [640, 140]
  },
  {
    id: 'africa',
    name: 'Africa',
    d: 'M 445,260 L 520,265 L 575,300 L 585,360 L 540,470 L 495,505 L 465,440 L 430,340 L 420,290 Z',
    center: [500, 380]
  },
  {
    id: 'middle-east-asia',
    name: 'Middle East & Central Asia',
    d: 'M 565,240 L 630,225 L 710,240 L 700,310 L 635,325 L 575,300 Z',
    center: [640, 270]
  },
  {
    id: 'east-asia',
    name: 'East Asia & China',
    d: 'M 710,180 L 820,175 L 850,230 L 810,310 L 730,310 L 690,240 Z',
    center: [770, 240]
  },
  {
    id: 'japan',
    name: 'Japan',
    d: 'M 865,195 L 880,210 L 865,245 L 855,235 Z',
    center: [870, 220]
  },
  {
    id: 'oceania-australia',
    name: 'Australia & Oceania',
    d: 'M 780,420 L 870,410 L 890,470 L 850,520 L 780,500 L 765,450 Z',
    center: [830, 460]
  }
]
