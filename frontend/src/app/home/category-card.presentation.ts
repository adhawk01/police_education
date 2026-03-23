import { HomeApiCategoryItem } from './home-api.models';

export interface HomeCategoryCardPresentation {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
}

type CategoryPresentationSeed = Omit<HomeCategoryCardPresentation, 'id' | 'title'>;

const DEFAULT_PRESENTATION: CategoryPresentationSeed = {
  subtitle: 'תכנים, כלים ויוזמות מקצועיות לשימוש מהיר במערכת החינוך והקהילה.',
  emoji: '🧭',
  color: '#334155'
};

const CATEGORY_PRESENTATION_BY_SLUG: Record<string, CategoryPresentationSeed> = {
  education: {
    subtitle: 'מערכי הדרכה, תכנים חינוכיים וכלים לפעילות עם תלמידים וצוותי חינוך.',
    emoji: '📘',
    color: '#15803d'
  },
  guidance: {
    subtitle: 'חומרי הנחיה, מצגות ודגשים מקצועיים לפעילות חינוכית בשטח.',
    emoji: '🧑‍🏫',
    color: '#2563eb'
  },
  community: {
    subtitle: 'יוזמות לשיתוף פעולה עם רשויות, קהילה, הורים ומסגרות מקומיות.',
    emoji: '🤝',
    color: '#d97706'
  },
  youth: {
    subtitle: 'תכנים לפעילות עם בני נוער, תלמידים מובילים וקבוצות מנהיגות.',
    emoji: '⭐',
    color: '#e11d48'
  },
  schools: {
    subtitle: 'כלים יישומיים לבתי ספר, ימי שיא ותכניות עבודה עם צוותי הוראה.',
    emoji: '🏫',
    color: '#2563eb'
  }
};

const ICON_NAME_TO_EMOJI: Record<string, string> = {
  education: '📘',
  book: '📘',
  school: '🏫',
  community: '🤝',
  guidance: '🧑‍🏫',
  training: '🧑‍🏫',
  youth: '⭐',
  leadership: '⭐',
  safety: '🛡️',
  awareness: '💡'
};

const NAMED_COLOR_TO_HEX: Record<string, string> = {
  blue: '#2563eb',
  green: '#15803d',
  orange: '#d97706',
  amber: '#d97706',
  yellow: '#d97706',
  red: '#e11d48',
  rose: '#e11d48',
  pink: '#e11d48',
  gray: '#334155',
  grey: '#334155',
  slate: '#334155'
};

function expandShortHexColor(hexColor: string): string {
  if (hexColor.length !== 3) {
    return hexColor;
  }

  return hexColor
    .split('')
    .map((character) => `${character}${character}`)
    .join('');
}

function parseHexColor(colorCode: string): { red: number; green: number; blue: number } | null {
  const normalizedHex = colorCode.replace('#', '');
  const expandedHex = expandShortHexColor(normalizedHex);

  if (!/^[0-9a-f]{6}$/i.test(expandedHex)) {
    return null;
  }

  return {
    red: Number.parseInt(expandedHex.slice(0, 2), 16),
    green: Number.parseInt(expandedHex.slice(2, 4), 16),
    blue: Number.parseInt(expandedHex.slice(4, 6), 16)
  };
}

function normalizeCategoryColor(colorCode: string, fallbackColor: string): string {
  if (colorCode in NAMED_COLOR_TO_HEX) {
    return NAMED_COLOR_TO_HEX[colorCode];
  }

  const rgbColor = parseHexColor(colorCode);

  if (!rgbColor) {
    return fallbackColor;
  }

  return `#${expandShortHexColor(colorCode.replace('#', ''))}`.toLowerCase();
}

export function normalizePresentationColor(colorCode: string | null | undefined, fallbackColor = DEFAULT_PRESENTATION.color): string {
  const normalizedColorCode = colorCode?.trim().toLowerCase() ?? '';

  if (normalizedColorCode === '') {
    return fallbackColor;
  }

  return normalizeCategoryColor(normalizedColorCode, fallbackColor);
}

export function mapHomeApiCategoryToPresentation(category: HomeApiCategoryItem): HomeCategoryCardPresentation {
  const presentation = CATEGORY_PRESENTATION_BY_SLUG[category.slug] ?? DEFAULT_PRESENTATION;
  const normalizedIconName = category.icon_name?.trim().toLowerCase() ?? '';
  const backendDescription = category.description?.trim();

  return {
    id: category.id,
    title: category.name,
    subtitle: backendDescription && backendDescription.length > 0 ? backendDescription : presentation.subtitle,
    emoji: ICON_NAME_TO_EMOJI[normalizedIconName] ?? category.icon_name ?? presentation.emoji,
    color: normalizePresentationColor(category.color_code, presentation.color)
  };
}