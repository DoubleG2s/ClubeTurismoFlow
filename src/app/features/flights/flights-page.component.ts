import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FlightCardComponent } from '../../components/flight-card/flight-card.component';
import { FlightFormComponent } from '../../components/flight-form/flight-form.component';
import { Flight } from '../../models/flight';

@Component({
  selector: 'app-flights-page',
  standalone: true,
  imports: [CommonModule, FlightFormComponent, FlightCardComponent],
  templateUrl: './flights-page.component.html'
})
export class FlightsPageComponent {
  @Input() flights: Flight[] = [];
  @Input() prefilledFlightData: Partial<Flight> | null = null;

  @Output() addFlight = new EventEmitter<Omit<Flight, 'id' | 'created_at' | 'confirmed'>>();
  @Output() editFlight = new EventEmitter<string>();
  @Output() removeFlight = new EventEmitter<string>();
  @Output() toggleConfirm = new EventEmitter<{ id: string; checked: boolean }>();
}
