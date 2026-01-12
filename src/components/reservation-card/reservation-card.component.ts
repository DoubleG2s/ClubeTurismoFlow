import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Reservation, ReservationChecklist } from '../../models/reservation';

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservation-card.component.html'
})
export class ReservationCardComponent {
  @Input({ required: true }) reservation!: Reservation;
  @Output() update = new EventEmitter<{id: string, data: Partial<Reservation>}>();
  @Output() remove = new EventEmitter<string>();
  @Output() edit = new EventEmitter<string>();
  @Output() addToFlights = new EventEmitter<Reservation>(); 

  get isComplete(): boolean {
    return Object.values(this.reservation.checklist).every(status => status === true);
  }

  // New Alert Logic with Priorities: Today > Critical (1 day) > Warning (2 days)
  get alertStatus(): 'today' | 'critical' | 'warning' | null {
    if (this.isComplete) return null; 

    const checkDateDiff = (dateStr?: string): number | null => {
      if (!dateStr) return null;
      
      const parts = dateStr.split('/');
      if (parts.length !== 3) return null;

      const targetDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
      const today = new Date();
      
      // Normalize to midnight to compare dates only
      targetDate.setHours(0,0,0,0);
      today.setHours(0,0,0,0);

      // Return difference in days
      return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Collect diffs for both dates (Ida and Volta)
    const diffs = [
      checkDateDiff(this.reservation.date),
      checkDateDiff(this.reservation.return_date)
    ].filter(d => d !== null) as number[];

    // Priority Logic
    if (diffs.includes(0)) return 'today';     // Viajando hoje
    if (diffs.includes(1)) return 'critical';  // 1 dia antes
    if (diffs.includes(2)) return 'warning';   // 2 dias antes

    return null;
  }

  onChecklistChange(key: keyof ReservationChecklist, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    
    const updatedChecklist = {
      ...this.reservation.checklist,
      [key]: checked
    };

    this.update.emit({
      id: this.reservation.id,
      data: { checklist: updatedChecklist }
    });
  }

  onNotesChange(event: Event) {
    const value = (event.target as HTMLTextAreaElement).value;
    if (value !== this.reservation.notes) {
      this.update.emit({
        id: this.reservation.id,
        data: { notes: value }
      });
    }
  }

  onVoucherClick(event: Event) {
    event.stopPropagation();
    if (this.reservation.flight_voucher) {
      this.addToFlights.emit(this.reservation);
    }
  }
}