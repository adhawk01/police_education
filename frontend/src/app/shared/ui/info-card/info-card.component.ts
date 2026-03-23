import { Component, input } from '@angular/core';

@Component({
  selector: 'app-info-card',
  standalone: true,
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.css'
})
export class InfoCardComponent {
  readonly title = input.required<string>();
  readonly text = input.required<string>();
}