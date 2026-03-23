import { Component, computed, input, output } from '@angular/core';

type CategoryCardPalette = {
  accent: string;
  surface: string;
  ring: string;
  shadow: string;
};

const DEFAULT_CATEGORY_COLOR = '#334155';

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
  const normalizedHex = colorCode.trim().replace('#', '');
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

function mixWithWhite(channel: number, amount: number): number {
  return Math.round(channel + (255 - channel) * amount);
}

function buildPalette(colorCode: string): CategoryCardPalette {
  const rgbColor = parseHexColor(colorCode) ?? parseHexColor(DEFAULT_CATEGORY_COLOR)!;
  const normalizedAccent = parseHexColor(colorCode) ? `#${expandShortHexColor(colorCode.trim().replace('#', ''))}`.toLowerCase() : DEFAULT_CATEGORY_COLOR;

  return {
    accent: normalizedAccent,
    surface: `rgb(${mixWithWhite(rgbColor.red, 0.9)} ${mixWithWhite(rgbColor.green, 0.9)} ${mixWithWhite(rgbColor.blue, 0.9)})`,
    ring: `rgb(${mixWithWhite(rgbColor.red, 0.72)} ${mixWithWhite(rgbColor.green, 0.72)} ${mixWithWhite(rgbColor.blue, 0.72)})`,
    shadow: `rgba(${rgbColor.red}, ${rgbColor.green}, ${rgbColor.blue}, 0.18)`
  };
}

@Component({
  selector: 'app-category-card',
  standalone: true,
  templateUrl: './category-card.component.html',
  styleUrl: './category-card.component.css'
})
export class CategoryCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly icon = input('🧭');
  readonly color = input(DEFAULT_CATEGORY_COLOR);
  readonly active = input(false);
  readonly selected = output<void>();

  readonly palette = computed(() => buildPalette(this.color()));
}