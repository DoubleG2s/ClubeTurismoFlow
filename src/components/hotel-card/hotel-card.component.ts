import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Hotel } from '../../models/hotel';

@Component({
    selector: 'app-hotel-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './hotel-card.component.html'
})
export class HotelCardComponent {
    @Input({ required: true }) hotel!: Hotel;

    @Output() edit = new EventEmitter<string>();
    @Output() remove = new EventEmitter<string>();

    getStarsArray(count: number | undefined): number[] {
        if (!count) return [];
        return Array(count).fill(0);
    }

    getEmptyStarsArray(count: number | undefined): number[] {
        if (!count) return Array(5).fill(0);
        return Array(5 - count).fill(0);
    }
}
