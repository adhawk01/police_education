import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-featured-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './featured-card.component.html',
  styleUrl: './featured-card.component.css'
})
export class FeaturedCardComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly category = input.required<string>();
  readonly region = input.required<string>();
  readonly tags = input.required<string[]>();
  readonly isFeatured = input(false);
  readonly active = input(false);
  readonly hoveredState = input(false);
  readonly hovered = output<void>();
  readonly unhovered = output<void>();
  readonly selected = output<void>();
}