import { Component, EventEmitter, Input, Output, OnInit, HostListener, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Hotel } from '../../models/hotel';
import { HotelService } from '../../services/hotel.service';

@Component({
    selector: 'app-hotel-details',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './hotel-details.component.html'
})
export class HotelDetailsComponent implements OnInit {
    @Input({ required: true }) hotel!: Hotel;
    @Output() close = new EventEmitter<void>();

    private hotelService = inject(HotelService);

    mainImage = signal<string>('');
    isEditingDescription = signal(false);
    editedDescription = signal('');
    isSavingDescription = signal(false);

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

    startEditDescription() {
        this.editedDescription.set(this.hotel.description || '');
        this.isEditingDescription.set(true);
    }

    cancelEditDescription() {
        this.isEditingDescription.set(false);
    }

    async saveDescription() {
        this.isSavingDescription.set(true);
        const success = await this.hotelService.updateHotel(
            this.hotel.id,
            { description: this.editedDescription() },
            [], [], [], [], [], []
        );
        if (success) {
            this.hotel = { ...this.hotel, description: this.editedDescription() };
        }
        this.isSavingDescription.set(false);
        this.isEditingDescription.set(false);
    }

    @HostListener('document:keydown.escape', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        if (this.isEditingDescription()) {
            this.cancelEditDescription();
        } else {
            this.close.emit();
        }
    }
}
