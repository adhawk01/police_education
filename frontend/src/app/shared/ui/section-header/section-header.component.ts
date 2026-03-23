import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-section-header',
  standalone: true,
  templateUrl: './section-header.component.html',
  styleUrl: './section-header.component.css'
})
export class SectionHeaderComponent {
  readonly title = input.required<string>();
  readonly note = input.required<string>();
  readonly actionLabel = input<string | null>(null);
  readonly iconActionLabel = input<string | null>(null);
  readonly actionTriggered = output<void>();
  readonly iconActionTriggered = output<void>();
}