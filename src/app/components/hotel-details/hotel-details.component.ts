import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Hotel } from '../../models/hotel';

@Component({
    selector: 'app-hotel-details',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './hotel-details.component.html'
})
export class HotelDetailsComponent implements OnInit {
    @Input({ required: true }) hotel!: Hotel;
    @Output() close = new EventEmitter<void>();

    mainImage = signal<string>('');

    ngOnInit() {
        if (this.hotel.hotel_images && this.hotel.hotel_images.length > 0) {
            this.mainImage.set(this.hotel.hotel_images[0].image_url);
        }
    }

    selectImage(url: string) {
        this.mainImage.set(url);
    }

    getStarsArray(count: number | undefined): number[] {
        if (!count) return [];
        return Array(count).fill(0);
    }

    // Listens for Escape key to close modal
    @HostListener('document:keydown.escape', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        this.close.emit();
    }
}
