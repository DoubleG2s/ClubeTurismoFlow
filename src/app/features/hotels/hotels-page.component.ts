import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HotelFormSubmission } from '../../components/hotel-form/hotel-form.types';
import { HotelCardComponent } from '../../components/hotel-card/hotel-card.component';
import { HotelEmailGeneratorComponent } from '../../components/hotel-email-generator/hotel-email-generator.component';
import { HotelFormComponent } from '../../components/hotel-form/hotel-form.component';
import { Hotel } from '../../models/hotel';
import { HotelSubTab } from '../../layout/app-shell.types';

@Component({
  selector: 'app-hotels-page',
  standalone: true,
  imports: [CommonModule, HotelFormComponent, HotelCardComponent, HotelEmailGeneratorComponent],
  templateUrl: './hotels-page.component.html'
})
export class HotelsPageComponent {
  @Input() activeSubTab: HotelSubTab = 'hoteis';
  @Input() isLoading = false;
  @Input() prefilledHotelName = '';
  @Input() filteredHotels: Hotel[] = [];
  @Input() hotelSearchInputValue = '';
  @Input() hotelSearchTerm = '';

  @Output() activeSubTabChange = new EventEmitter<HotelSubTab>();
  @Output() saveHotel = new EventEmitter<HotelFormSubmission>();
  @Output() hotelSearchInputChange = new EventEmitter<string>();
  @Output() clearHotelSearch = new EventEmitter<void>();
  @Output() viewHotel = new EventEmitter<string>();
  @Output() editHotel = new EventEmitter<string>();
  @Output() removeHotel = new EventEmitter<string>();

  selectSubTab(tab: HotelSubTab) {
    this.activeSubTabChange.emit(tab);
  }
}
