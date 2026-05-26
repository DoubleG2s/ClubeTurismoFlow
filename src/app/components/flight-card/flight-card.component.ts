import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Flight } from '../../models/flight';

@Component({
  selector: 'app-flight-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flight-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlightCardComponent {
  @Input({ required: true }) flight!: Flight;
  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();
  @Output() toggleConfirm = new EventEmitter<{id: string, checked: boolean}>();

  onCheckboxChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.toggleConfirm.emit({
      id: this.flight.id,
      checked: checkbox.checked
    });
  }
}