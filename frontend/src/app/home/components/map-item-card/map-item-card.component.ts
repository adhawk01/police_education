import { Component, computed, input, output } from '@angular/core';
import { HomeApiFeaturedItem } from '../../home-api.models';

@Component({
  selector: 'app-map-item-card',
  standalone: true,
  templateUrl: './map-item-card.component.html',
  styleUrl: './map-item-card.component.css'
})
export class MapItemCardComponent {
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
}