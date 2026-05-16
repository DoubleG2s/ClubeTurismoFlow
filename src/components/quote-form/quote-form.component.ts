import { Component, EventEmitter, Input, Output, OnInit, SimpleChanges, OnChanges, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Quote, QuoteOption } from '../../models/quote';
import { HotelService } from '../../services/hotel.service';
import { Hotel } from '../../models/hotel';
import { CityAutocompleteComponent } from '../shared/city-autocomplete/city-autocomplete.component';

@Component({
  selector: 'app-quote-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CityAutocompleteComponent],
  templateUrl: './quote-form.component.html',
})
export class QuoteFormComponent implements OnInit, OnChanges {
  @Input() quoteToEdit: Quote | null = null;
  @Input() isLoading = false;
  @Input() prefillData: Partial<Quote> | null = null;

  @Output() save = new EventEmitter<Omit<Quote, 'id' | 'created_at'>>();
  @Output() update = new EventEmitter<{ id: string, data: Partial<Quote> }>();
  @Output() cancel = new EventEmitter<void>();

  quoteForm!: FormGroup;
  isEditMode = signal(false);

  // States
  hotelService = inject(HotelService);
  activeHotelDropdownIndex = signal<{ optionIndex: number, hotelIndex: number } | null>(null);
  activeOptionIndex = signal<number>(0);

  private cdr = inject(ChangeDetectorRef);

  constructor(private fb: FormBuilder) {
    this.initForm();
  }

  private initForm() {
    this.quoteForm = this.fb.group({
      title: ['', Validators.required],
      subtitle: [''],
      supplier: ['', Validators.required],
      options: this.fb.array([])
    });
  }

  get quoteOptions() {
    return this.quoteForm.get('options') as FormArray;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['prefillData'] && this.prefillData && !this.isEditMode()) {
       this.quoteForm.patchValue({
         title: this.prefillData.title || '',
       });
       if (this.quoteOptions.length > 0) {
         this.quoteOptions.at(0).patchValue({
           adults: this.prefillData.adults || 2,
           children: this.prefillData.children || 0
         });
       }
    }
  }

  ngOnInit() {
    if (this.quoteToEdit) {
      this.isEditMode.set(true);

      this.quoteForm.patchValue({
        title: this.quoteToEdit.title,
        subtitle: this.quoteToEdit.subtitle,
        supplier: this.quoteToEdit.supplier,
      });

      this.quoteOptions.clear();

      // Check if it's the new format with options
      if (this.quoteToEdit.options && this.quoteToEdit.options.length > 0) {
        this.quoteToEdit.options.forEach(opt => {
          this.addQuoteOption(opt);
        });
      } else {
        // Legacy format mapping
        this.addQuoteOption({
          check_in: this.quoteToEdit.check_in,
          check_out: this.quoteToEdit.check_out,
          adults: this.quoteToEdit.adults,
          children: this.quoteToEdit.children,
          tour_details: this.quoteToEdit.tour_details,
          has_transfer: this.quoteToEdit.has_transfer,
          flight_details: this.quoteToEdit.flight_details,
          hotel_options: this.quoteToEdit.hotel_options
        });
      }
    } else {
      // New quote
      this.addQuoteOption();
    }
  }

  createQuoteOptionGroup(data?: any): FormGroup {
    const group = this.fb.group({
      title: [data?.title || ''],
      check_in: [data?.check_in || '', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      check_out: [data?.check_out || '', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      adults: [data?.adults || 2, [Validators.required, Validators.min(1)]],
      children: [data?.children || 0, [Validators.required, Validators.min(0)]],
      tour_details: [data?.tour_details || ''],
      has_transfer: [data?.has_transfer || false],
      flight_details: this.fb.group({
        outbound: this.fb.group({
          origin_city: [data?.flight_details?.outbound?.origin_city || '', Validators.required],
          destination_city: [data?.flight_details?.outbound?.destination_city || '', Validators.required],
          departure_time: [data?.flight_details?.outbound?.departure_time || '', Validators.required],
          arrival_time: [data?.flight_details?.outbound?.arrival_time || '', Validators.required],
          has_connection: [data?.flight_details?.outbound?.has_connection || false],
          connection_city: [data?.flight_details?.outbound?.connection_city || ''],
          connection_time: [data?.flight_details?.outbound?.connection_time || '']
        }),
        inbound: this.fb.group({
          origin_city: [data?.flight_details?.inbound?.origin_city || '', Validators.required],
          destination_city: [data?.flight_details?.inbound?.destination_city || '', Validators.required],
          departure_time: [data?.flight_details?.inbound?.departure_time || '', Validators.required],
          arrival_time: [data?.flight_details?.inbound?.arrival_time || '', Validators.required],
          has_connection: [data?.flight_details?.inbound?.has_connection || false],
          connection_city: [data?.flight_details?.inbound?.connection_city || ''],
          connection_time: [data?.flight_details?.inbound?.connection_time || '']
        })
      }),
      hotel_options: this.fb.array([])
    });

    const hotelOptionsArray = group.get('hotel_options') as FormArray;
    if (data?.hotel_options && data.hotel_options.length > 0) {
      data.hotel_options.forEach((h: any) => {
        hotelOptionsArray.push(this.createHotelOptionGroup({ ...h, amount: this.formatNumberToString(h.amount) }));
      });
    } else {
      hotelOptionsArray.push(this.createHotelOptionGroup());
    }

    return group;
  }

  addQuoteOption(data?: any) {
    this.quoteOptions.push(this.createQuoteOptionGroup(data));
    this.activeOptionIndex.set(this.quoteOptions.length - 1);
  }

  duplicateOption(index: number) {
    // Realiza deep clone para garantir que arrays (como hotel_images) não compartilhem referência
    const currentData = JSON.parse(JSON.stringify(this.quoteOptions.at(index).value));
    
    // Gera um novo ID único para isolar completamente a opção no proposal
    currentData.id = crypto.randomUUID();
    
    this.addQuoteOption(currentData);
  }

  removeQuoteOption(index: number) {
    if (this.quoteOptions.length > 1) {
      this.quoteOptions.removeAt(index);
      if (this.activeOptionIndex() >= this.quoteOptions.length) {
        this.activeOptionIndex.set(this.quoteOptions.length - 1);
      }
    }
  }

  getHotelOptions(optionIndex: number): FormArray {
    return this.quoteOptions.at(optionIndex).get('hotel_options') as FormArray;
  }

  createHotelOptionGroup(data?: any): FormGroup {
    return this.fb.group({
      hotel_id: [data?.hotel_id || ''],
      hotel_images: [data?.hotel_images || []],
      hotel_name: [data?.hotel_name || '', Validators.required],
      regime: [data?.regime || '', Validators.required],
      accommodation: [data?.accommodation || '', Validators.required],
      amount: [data?.amount || '', Validators.required],
      currency: [data?.currency || 'BRL', Validators.required],
      link: [data?.link || '']
    });
  }

  addHotelOption(optionIndex: number, data?: any) {
    this.getHotelOptions(optionIndex).push(this.createHotelOptionGroup(data));
  }

  removeHotelOption(optionIndex: number, hotelIndex: number) {
    const arr = this.getHotelOptions(optionIndex);
    if (arr.length > 1) {
      arr.removeAt(hotelIndex);
    }
  }

  // --- AUTOCOMPLETE HOTÉIS ---

  getFilteredHotels(optionIndex: number, hotelIndex: number): Hotel[] {
    const term = this.getHotelOptions(optionIndex).at(hotelIndex).get('hotel_name')?.value?.toLowerCase() || '';
    const allHotels = this.hotelService.hotels();
    if (!term) return allHotels;
    return allHotels.filter(h => h.name.toLowerCase().includes(term));
  }

  selectHotelFromSearch(optionIndex: number, hotelIndex: number, hotel: Hotel) {
    const images = hotel.hotel_images ? hotel.hotel_images.map(img => img.image_url) : [];
    this.getHotelOptions(optionIndex).at(hotelIndex).patchValue({
      hotel_id: hotel.id,
      hotel_name: hotel.name,
      hotel_images: images
    });
    this.activeHotelDropdownIndex.set(null);
  }

  onHotelBlur() {
    setTimeout(() => this.activeHotelDropdownIndex.set(null), 200);
  }

  openHotelCreation(optionIndex: number, hotelIndex: number) {
     const term = this.getHotelOptions(optionIndex).at(hotelIndex).get('hotel_name')?.value || '';
     window.open(`/?tab=hotel&new=${encodeURIComponent(term)}`, '_blank');
  }

  // --- IMAGENS PASTE/UPLOAD ---

  async handleImagePaste(event: ClipboardEvent, optionIndex: number, hotelIndex: number) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          await this.uploadAndSetImage(file, optionIndex, hotelIndex);
        }
      }
    }
  }

  async handleImageFileSelect(event: Event, optionIndex: number, hotelIndex: number) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      await this.uploadAndSetImage(file, optionIndex, hotelIndex);
      input.value = ''; // Reset
    }
  }

  private async uploadAndSetImage(file: File, optionIndex: number, hotelIndex: number) {
    const publicUrl = await this.hotelService.uploadImage(file);
    if (publicUrl) {
      const control = this.getHotelOptions(optionIndex).at(hotelIndex).get('hotel_images');
      const currentImages = control?.value || [];
      control?.setValue([...currentImages, publicUrl]);
    }
  }

  removeHotelImage(optionIndex: number, hotelIndex: number, imageIndex: number) {
    const control = this.getHotelOptions(optionIndex).at(hotelIndex).get('hotel_images');
    const currentImages = control?.value || [];
    currentImages.splice(imageIndex, 1);
    control?.setValue([...currentImages]);
  }

  // --- MÁSCARA MONETÁRIA ---

  private formatNumberToString(value: number): string {
    if (value === undefined || value === null) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  onCurrencyInput(event: Event, optionIndex: number, hotelIndex: number) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); 

    if (!value) {
      this.getHotelOptions(optionIndex).at(hotelIndex).get('amount')?.setValue('');
      return;
    }

    const floatValue = parseFloat(value) / 100;
    const formatted = floatValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    input.value = formatted;
    this.getHotelOptions(optionIndex).at(hotelIndex).get('amount')?.setValue(formatted);
  }

  private parseCurrencyString(value: string): number {
    if (!value) return 0;
    const cleanValue = value.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue);
  }

  // -------------------------

  resetForm() {
    this.isEditMode.set(false);
    this.initForm();
    this.addQuoteOption();
    this.cdr.markForCheck();
  }

  onDateInput(event: Event, optionIndex: number, controlName: string) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length >= 5) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4);
    } else if (value.length >= 3) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    input.value = value;
    this.quoteOptions.at(optionIndex).get(controlName)?.setValue(value);
  }

  onTimeInput(event: Event, optionIndex: number, groupName: string, controlName: string) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 3) {
      value = value.slice(0, 2) + ':' + value.slice(2);
    }
    input.value = value;

    this.quoteOptions.at(optionIndex).get('flight_details')?.get(groupName)?.get(controlName)?.setValue(value);
  }

  onSubmit() {
    if (this.quoteForm.valid) {
      const formValue = this.quoteForm.value;

      const processedOptions = formValue.options.map((opt: any) => {
        const processedHotels = opt.hotel_options.map((hotel: any) => ({
          ...hotel,
          amount: typeof hotel.amount === 'string' ? this.parseCurrencyString(hotel.amount) : hotel.amount
        }));
        return {
          ...opt,
          hotel_options: processedHotels
        };
      });

      const finalPayload = {
        title: formValue.title,
        subtitle: formValue.subtitle,
        supplier: formValue.supplier,
        options: processedOptions
      };

      if (this.isEditMode() && this.quoteToEdit) {
        this.update.emit({
          id: this.quoteToEdit.id,
          data: finalPayload
        });
      } else {
        this.save.emit(finalPayload);
      }
    } else {
      this.quoteForm.markAllAsTouched();
      alert('Por favor, preencha todos os campos obrigatórios.');
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}