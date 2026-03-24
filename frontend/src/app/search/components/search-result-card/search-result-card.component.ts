import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { SearchResultItem } from '../../search.models';

@Component({
  selector: 'app-search-result-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './search-result-card.component.html',
  styleUrl: './search-result-card.component.css'
})
export class SearchResultCardComponent {
  readonly item = input.required<SearchResultItem>();
  readonly selected = output<void>();

  readonly metadataChips = computed(() => {
    const metadata = this.item().metadata;

    return [
      metadata.area,
      metadata.city,
      metadata.age_text,
      metadata.participants_text,
      metadata.price_text,
      metadata.status_text,
      metadata.schedule_text,
    ].filter((value): value is string => Boolean(value && value.trim()));
  });

  readonly description = computed(() => {
    const fullDescription = this.item().full_description?.trim();

    if (fullDescription) {
      return fullDescription;
    }

    return this.item().short_description?.trim() || 'ללא תיאור זמין';
  });

  openDetails(): void {
    this.selected.emit();
  }
}