import { CommonModule } from '@angular/common';
import { Component, computed, input, output, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SearchResultItem } from '../../search.models';

@Component({
  selector: 'app-search-result-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './search-result-card.component.html',
  styleUrl: './search-result-card.component.css'
})
export class SearchResultCardComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly item = input.required<SearchResultItem>();
  readonly selected = output<void>();

  readonly metadataChips = computed(() => {
    const metadata = this.item().metadata;
    const chips: string[] = [];

    if (metadata.area?.trim()) {
      chips.push(`אזור: ${metadata.area.trim()}`);
    }

    if (metadata.city?.trim()) {
      chips.push(`עיר: ${metadata.city.trim()}`);
    }

    if (metadata.age_text?.trim()) {
      chips.push(`קהל יעד: ${metadata.age_text.trim()}`);
    }

    return chips;
  });

  readonly description = computed(() => {
    const fullDescription = this.item().full_description?.trim();

    if (fullDescription) {
      return fullDescription;
    }

    return this.item().short_description?.trim() || 'ללא תיאור זמין';
  });

  readonly descriptionHtml = computed<SafeHtml>(() => this.renderSimpleMarkdown(this.description()));

  openDetails(): void {
    this.selected.emit();
  }

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