import { Component, computed, input, output, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HomeApiFeaturedItem } from '../../home-api.models';

@Component({
  selector: 'app-map-item-card',
  standalone: true,
  templateUrl: './map-item-card.component.html',
  styleUrl: './map-item-card.component.css'
})
export class MapItemCardComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly item = input.required<HomeApiFeaturedItem>();
  readonly active = input(false);
  readonly showFavoriteIcon = input(false);
  readonly hovered = output<void>();
  readonly unhovered = output<void>();
  readonly selected = output<void>();

  readonly isFeatured = computed(() => this.item().is_featured === 1 || this.item().is_featured === true);

  readonly description = computed(() => {
    const fullDescription = this.item().full_description?.trim();

    if (fullDescription) {
      return fullDescription;
    }

    const shortDescription = this.item().short_description?.trim();

    if (shortDescription) {
      return shortDescription;
    }

    return 'ללא תיאור זמין';
  });

  readonly descriptionHtml = computed<SafeHtml>(() => this.renderSimpleMarkdown(this.description()));

  private renderSimpleMarkdown(markdown: string): SafeHtml {
    const escapeHtml = (value: string): string =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const formatInline = (value: string): string =>
      value
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

    const lines = (markdown || '').split(/\r?\n/);
    const html: string[] = [];
    let inList = false;

    const closeList = (): void => {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
    };

    for (const rawLine of lines) {
      const line = escapeHtml(rawLine.trim());

      if (!line) {
        closeList();
        continue;
      }

      if (line.startsWith('## ')) {
        closeList();
        html.push(`<h4>${formatInline(line.slice(3))}</h4>`);
        continue;
      }

      if (line.startsWith('- ')) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }

        html.push(`<li>${formatInline(line.slice(2))}</li>`);
        continue;
      }

      closeList();
      html.push(`<p>${formatInline(line)}</p>`);
    }

    closeList();

    return this.sanitizer.bypassSecurityTrustHtml(html.join(''));
  }
}