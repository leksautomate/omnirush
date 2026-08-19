import type { StoryboardInput } from '@/remotion/schema'

export const DEMO_STORYBOARD: StoryboardInput = {
  width: 1280,
  height: 720,
  fps: 30,
  brand: {
    channel: 'Kakkao Studio',
    accent: '#ff2d55'
  },
  voiceVolume: 1.0,
  musicVolume: 0.15,
  captionStyle: 'normal',
  shots: [
    {
      kind: 'photo',
      src: 'https://images.unsplash.com/photo-1517976487545-56064f7b233a?auto=format&fit=crop&w=1280&q=80',
      start: 0,
      duration: 3.8,
      overlay: {
        type: 'film-burn'
      },
      narration:
        'Fifty years ago, humanity took its very first step into the deep cosmic unknown.',
      words: [
        { word: 'Fifty', start: 0.1, end: 0.45 },
        { word: 'years', start: 0.46, end: 0.75 },
        { word: 'ago,', start: 0.76, end: 1.1 },
        { word: 'humanity', start: 1.2, end: 1.65 },
        { word: 'took', start: 1.66, end: 1.9 },
        { word: 'its', start: 1.91, end: 2.05 },
        { word: 'very', start: 2.06, end: 2.35 },
        { word: 'first', start: 2.36, end: 2.7 },
        { word: 'step', start: 2.71, end: 3.0 },
        { word: 'into', start: 3.01, end: 3.25 },
        { word: 'the', start: 3.26, end: 3.4 },
        { word: 'deep', start: 3.41, end: 3.6 },
        { word: 'unknown.', start: 3.61, end: 3.8 }
      ]
    },
    {
      kind: 'photo',
      src: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1280&q=80',
      start: 3.8,
      duration: 3.6,
      overlay: {
        type: 'number-counter',
        numberValue: 240000,
        numberLabel: 'MILES TRAVELED'
      },
      narration:
        'Aboard Apollo 11, three astronauts journeyed across 240,000 miles of vacuum.',
      words: [
        { word: 'Aboard', start: 3.9, end: 4.25 },
        { word: 'Apollo', start: 4.26, end: 4.65 },
        { word: '11,', start: 4.66, end: 5.0 },
        { word: 'three', start: 5.1, end: 5.4 },
        { word: 'astronauts', start: 5.41, end: 6.0 },
        { word: 'journeyed', start: 6.01, end: 6.45 },
        { word: 'across', start: 6.46, end: 6.8 },
        { word: '240,000', start: 6.81, end: 7.15 },
        { word: 'miles.', start: 7.16, end: 7.4 }
      ]
    },
    {
      kind: 'photo',
      src: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1280&q=80',
      start: 7.4,
      duration: 4.0,
      overlay: {
        type: 'newspaper',
        publication: 'THE DAILY CHRONICLE',
        issueDate: 'July 20, 1969 · Special Space Edition',
        category: 'HISTORIC MILESTONE',
        headline: 'HUMANKIND LANDS ON THE MOON IN HISTORIC GIANT LEAP',
        highlightWords: ['LANDS', 'ON', 'THE', 'MOON', 'HISTORIC', 'LEAP'],
        summary: 'Astronauts touch down successfully in the Sea of Tranquility marking humanity’s greatest technological triumph.'
      },
      narration:
        'Touching down in the Sea of Tranquility, they proved that no frontier is out of reach.',
      words: [
        { word: 'Touching', start: 7.5, end: 7.85 },
        { word: 'down', start: 7.86, end: 8.1 },
        { word: 'in', start: 8.11, end: 8.25 },
        { word: 'the', start: 8.26, end: 8.4 },
        { word: 'Sea', start: 8.41, end: 8.65 },
        { word: 'of', start: 8.66, end: 8.8 },
        { word: 'Tranquility,', start: 8.81, end: 9.4 },
        { word: 'they', start: 9.5, end: 9.7 },
        { word: 'proved', start: 9.71, end: 10.05 },
        { word: 'that', start: 10.06, end: 10.2 },
        { word: 'no', start: 10.21, end: 10.4 },
        { word: 'frontier', start: 10.41, end: 10.8 },
        { word: 'is', start: 10.81, end: 10.95 },
        { word: 'out', start: 10.96, end: 11.15 },
        { word: 'of', start: 11.16, end: 11.25 },
        { word: 'reach.', start: 11.26, end: 11.4 }
      ]
    },
    {
      kind: 'photo',
      start: 11.4,
      duration: 5.0,
      overlay: {
        type: 'animated-map',
        mapTitle: 'TACTICAL SATELLITE RECONNAISSANCE & FLIGHT PATH',
        fromLabel: 'LONDON (SUPREME HQ)',
        toLabel: 'NORMANDY (OPERATION OVERLORD)'
      },
      narration:
        'Under cover of darkness, Allied reconnaissance plotted the cross-channel flight trajectory directly toward the Normandy beaches.'
    },
    {
      kind: 'comparison',
      start: 15.9,
      duration: 6.0,
      narration:
        'Across history, prominent reformers and leaders left lasting legacies throughout Europe.',
      comparisonCards: [
        {
          name: 'Martin Luther',
          role: 'Protestant Reformer who challenged Catholic Church',
          country: 'Germany',
          countryCode: 'de',
          lifespan: '1483–1546',
          portraitUrl:
            'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Martin_Luther_by_Cranach-2.jpg/440px-Martin_Luther_by_Cranach-2.jpg',
          cause: 'Illness',
          statNumber: 62,
          statLabel: 'AGE'
        },
        {
          name: 'John Calvin',
          role: 'Protestant theologian who shaped Reformed Christianity',
          country: 'France',
          countryCode: 'fr',
          lifespan: '1509–1564',
          portraitUrl:
            'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/John_Calvin_Museum_Catharijneconvent_RMCC_s72_cropped.png/440px-John_Calvin_Museum_Catharijneconvent_RMCC_s72_cropped.png',
          cause: 'Prolonged illness',
          statNumber: 54,
          statLabel: 'AGE'
        },
        {
          name: 'John Wesley',
          role: 'Founder of the Methodist movement',
          country: 'England',
          countryCode: 'gb-eng',
          lifespan: '1703–1791',
          portraitUrl:
            'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/John_Wesley_by_George_Romney.jpg/440px-John_Wesley_by_George_Romney.jpg',
          cause: 'Illness',
          statNumber: 87,
          statLabel: 'AGE'
        }
      ]
    }
  ]
}
