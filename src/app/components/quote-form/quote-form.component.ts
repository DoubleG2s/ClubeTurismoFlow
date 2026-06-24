import { Component, EventEmitter, Input, Output, OnInit, SimpleChanges, OnChanges, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Quote, QuoteOption } from '../../models/quote';
import { HotelService } from '../../services/hotel.service';
import { Hotel } from '../../models/hotel';
import { IataAirportInputComponent } from '../shared/iata-airport-input/iata-airport-input.component';
import { LucideAngularModule, PlaneTakeoff, ClipboardPaste } from 'lucide-angular';
import { QuoteAiFillComponent, AiFillApplyEvent } from '../quote-ai-fill/quote-ai-fill.component';
import { HotelFormComponent } from '../hotel-form/hotel-form.component';
import { HotelFormSubmission } from '../hotel-form/hotel-form.types';

@Component({
  selector: 'app-quote-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IataAirportInputComponent, LucideAngularModule, QuoteAiFillComponent, HotelFormComponent],
  templateUrl: './quote-form.component.html',
})
export class QuoteFormComponent implements OnInit, OnChanges {
  @Input() quoteToEdit: Quote | null = null;
  @Input() isLoading = false;
  @Input() prefillData: Partial<Quote> | null = null;
  @Input() duplicateFrom: Quote | null = null;

  @Output() save = new EventEmitter<Omit<Quote, 'id' | 'created_at'>>();
  @Output() update = new EventEmitter<{ id: string, data: Partial<Quote> }>();
  @Output() cancel = new EventEmitter<void>();
  @Output() duplicateFilled = new EventEmitter<void>();

  quoteForm!: FormGroup;
  isEditMode = signal(false);
  readonly PlaneTakeoff = PlaneTakeoff;
  readonly ClipboardPaste = ClipboardPaste;

  // States
  hotelService = inject(HotelService);
  activeHotelDropdownIndex = signal<{ optionIndex: number, hotelIndex: number } | null>(null);
  activeOptionIndex = signal<number>(0);
  
  // Image Upload Feedbacks
  uploadingStates = signal<Record<string, boolean>>({});
  uploadSuccessStates = signal<Record<string, boolean>>({});

  // AI Fill
  showAiFillModal = signal(false);
  aiFillTargetIndex = signal(0);
  aiHighlightedOption = signal<number | null>(null);
  toastMessage = signal<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Hotel Creation Modal
  showHotelCreationModal = signal(false);
  hotelCreationOptIndex = signal(0);
  hotelCreationHotelIndex = signal(0);
  hotelCreationPrefill = signal('');
  isCreatingHotel = signal(false);

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
    if (changes['duplicateFrom'] && this.duplicateFrom && !this.isEditMode()) {
      this.fillFromDuplicate(this.duplicateFrom);
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
    } else if (this.duplicateFrom) {
      this.fillFromDuplicate(this.duplicateFrom);
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
          connection_time: [data?.flight_details?.outbound?.connection_time || ''],
          seats_included: [data?.flight_details?.outbound?.seats_included || false],
          checked_baggage: [data?.flight_details?.outbound?.checked_baggage || false]
        }),
        inbound: this.fb.group({
          origin_city: [data?.flight_details?.inbound?.origin_city || '', Validators.required],
          destination_city: [data?.flight_details?.inbound?.destination_city || '', Validators.required],
          departure_time: [data?.flight_details?.inbound?.departure_time || '', Validators.required],
          arrival_time: [data?.flight_details?.inbound?.arrival_time || '', Validators.required],
          has_connection: [data?.flight_details?.inbound?.has_connection || false],
          connection_city: [data?.flight_details?.inbound?.connection_city || ''],
          connection_time: [data?.flight_details?.inbound?.connection_time || ''],
          seats_included: [data?.flight_details?.inbound?.seats_included || false],
          checked_baggage: [data?.flight_details?.inbound?.checked_baggage || false]
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
      regime: [data?.regime || 'Café da manhã', Validators.required],
      accommodation: [data?.accommodation || '', Validators.required],
      amount: [data?.amount || '', Validators.required],
      currency: [data?.currency || 'BRL', Validators.required],
      link: [data?.link || ''],
      description: [data?.description || '']
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
      hotel_images: images,
      description: hotel.description || '',
      link: hotel.photos_link || ''
    });
    this.activeHotelDropdownIndex.set(null);
  }

  onHotelBlur() {
    setTimeout(() => this.activeHotelDropdownIndex.set(null), 200);
  }

  openHotelCreation(optionIndex: number, hotelIndex: number) {
    const term = this.getHotelOptions(optionIndex).at(hotelIndex).get('hotel_name')?.value || '';
    this.hotelCreationOptIndex.set(optionIndex);
    this.hotelCreationHotelIndex.set(hotelIndex);
    this.hotelCreationPrefill.set(term);
    this.activeHotelDropdownIndex.set(null);
    this.showHotelCreationModal.set(true);
  }

  async onHotelCreationSave(submission: HotelFormSubmission) {
    this.isCreatingHotel.set(true);
    const newHotel = await this.hotelService.addHotel(
      submission.hotelData,
      submission.emails,
      submission.phones,
      submission.images
    );
    this.isCreatingHotel.set(false);

    if (newHotel) {
      this.showHotelCreationModal.set(false);
      this.selectHotelFromSearch(
        this.hotelCreationOptIndex(),
        this.hotelCreationHotelIndex(),
        newHotel
      );
      this.showToast('Hotel cadastrado e selecionado com sucesso!', 'success');
    } else {
      this.showToast('Erro ao cadastrar o hotel. Tente novamente.', 'error');
    }
  }

  closeHotelCreationModal() {
    this.showHotelCreationModal.set(false);
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

  async pasteImageFromClipboard(optionIndex: number, hotelIndex: number) {
    try {
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'pasted-image.png', { type: imageType });
          await this.uploadAndSetImage(file, optionIndex, hotelIndex);
          found = true;
          break;
        }
      }
      if (!found) {
        this.showToast('Nenhuma imagem encontrada na área de transferência.', 'error');
      }
    } catch {
      this.showToast('Não foi possível acessar a área de transferência. Tente Ctrl+V diretamente na área de fotos.', 'error');
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

  isUploadingImage(optionIndex: number, hotelIndex: number): boolean {
    return this.uploadingStates()[`${optionIndex}-${hotelIndex}`] || false;
  }

  isUploadSuccess(optionIndex: number, hotelIndex: number): boolean {
    return this.uploadSuccessStates()[`${optionIndex}-${hotelIndex}`] || false;
  }

  private async uploadAndSetImage(file: File, optionIndex: number, hotelIndex: number) {
    const key = `${optionIndex}-${hotelIndex}`;
    this.uploadingStates.update(state => ({ ...state, [key]: true }));
    this.uploadSuccessStates.update(state => ({ ...state, [key]: false }));

    try {
      const publicUrl = await this.hotelService.uploadImage(file);
      if (publicUrl) {
        const control = this.getHotelOptions(optionIndex).at(hotelIndex).get('hotel_images');
        const currentImages = control?.value || [];
        control?.setValue([...currentImages, publicUrl]);
        
        // Show success feedback
        this.uploadSuccessStates.update(state => ({ ...state, [key]: true }));
        setTimeout(() => {
          this.uploadSuccessStates.update(state => ({ ...state, [key]: false }));
        }, 3000);
      }
    } finally {
      this.uploadingStates.update(state => ({ ...state, [key]: false }));
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

  fillFromDuplicate(source: Quote) {
    this.isEditMode.set(false);
    this.quoteForm.patchValue({
      title: 'Cópia de ' + source.title,
      subtitle: source.subtitle || '',
      supplier: source.supplier || '',
    });
    this.quoteOptions.clear();
    if (source.options && source.options.length > 0) {
      source.options.forEach(opt => this.addQuoteOption(opt));
    } else {
      this.addQuoteOption({
        check_in: source.check_in,
        check_out: source.check_out,
        adults: source.adults,
        children: source.children,
        tour_details: source.tour_details,
        has_transfer: source.has_transfer,
        flight_details: source.flight_details,
        hotel_options: source.hotel_options,
      });
    }
    this.activeOptionIndex.set(0);
    this.cdr.markForCheck();
    this.duplicateFilled.emit();
  }

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

  onNativeDateSelect(event: Event, optionIndex: number, controlName: string) {
    const input = event.target as HTMLInputElement;
    if (!input.value) return;
    
    // input.value from type="date" is always YYYY-MM-DD
    const [year, month, day] = input.value.split('-');
    if (year && month && day) {
      const formattedDate = `${day}/${month}/${year}`;
      this.quoteOptions.at(optionIndex).get(controlName)?.setValue(formattedDate);
    }
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

  // --- PREENCHIMENTO INTELIGENTE (IA) ---

  openAiFill(optionIndex: number) {
    this.aiFillTargetIndex.set(optionIndex);
    this.showAiFillModal.set(true);
  }

  getOptionHasData(optionIndex: number): boolean {
    const opt = this.quoteOptions.at(optionIndex)?.value;
    if (!opt) return false;
    return !!(opt.check_in || opt.check_out ||
      opt.flight_details?.outbound?.origin_city ||
      opt.hotel_options?.[0]?.hotel_name);
  }

  onAiFillApply(event: AiFillApplyEvent) {
    this.showAiFillModal.set(false);
    const { optionIndex, data } = event;
    const optControl = this.quoteOptions.at(optionIndex);
    if (!optControl) return;

    const topLevel: Record<string, any> = {};
    if (data.check_in) topLevel['check_in'] = data.check_in;
    if (data.check_out) topLevel['check_out'] = data.check_out;
    if (data.adults != null) topLevel['adults'] = data.adults;
    if (data.children != null) topLevel['children'] = data.children;
    if (data.tour_details) topLevel['tour_details'] = data.tour_details;
    if (data.has_transfer != null) topLevel['has_transfer'] = data.has_transfer;
    if (Object.keys(topLevel).length) optControl.patchValue(topLevel);

    const flightGroup = optControl.get('flight_details');
    if (flightGroup && data.outbound) {
      flightGroup.get('outbound')?.patchValue({
        origin_city: data.outbound.origin_city ?? '',
        destination_city: data.outbound.destination_city ?? '',
        departure_time: data.outbound.departure_time ?? '',
        arrival_time: data.outbound.arrival_time ?? '',
        has_connection: data.outbound.has_connection ?? false,
        connection_city: data.outbound.connection_city ?? '',
        connection_time: data.outbound.connection_time ?? '',
        seats_included: data.outbound.seats_included ?? false,
        checked_baggage: data.outbound.checked_baggage ?? false,
      });
    }
    if (flightGroup && data.inbound) {
      flightGroup.get('inbound')?.patchValue({
        origin_city: data.inbound.origin_city ?? '',
        destination_city: data.inbound.destination_city ?? '',
        departure_time: data.inbound.departure_time ?? '',
        arrival_time: data.inbound.arrival_time ?? '',
        has_connection: data.inbound.has_connection ?? false,
        connection_city: data.inbound.connection_city ?? '',
        connection_time: data.inbound.connection_time ?? '',
        seats_included: data.inbound.seats_included ?? false,
        checked_baggage: data.inbound.checked_baggage ?? false,
      });
    }

    if (data.hotel) {
      const hotelArr = this.getHotelOptions(optionIndex);
      if (hotelArr.length > 0) {
        const hotelPatch: Record<string, any> = {};
        if (data.hotel.hotel_name) hotelPatch['hotel_name'] = data.hotel.hotel_name;
        if (data.hotel.regime) hotelPatch['regime'] = data.hotel.regime;
        if (data.hotel.accommodation) hotelPatch['accommodation'] = data.hotel.accommodation;
        if (data.hotel.currency) hotelPatch['currency'] = data.hotel.currency;
        if (data.hotel.amount != null) {
          hotelPatch['amount'] = data.hotel.amount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
          });
        }
        hotelArr.at(0).patchValue(hotelPatch);
      }
    }

    this.activeOptionIndex.set(optionIndex);
    this.aiHighlightedOption.set(optionIndex);
    setTimeout(() => this.aiHighlightedOption.set(null), 2500);

    if (event.filledFields.length > 0) {
      this.showToast(`✨ ${event.filledFields.length} campos preenchidos com sucesso!`, 'success');
    } else {
      this.showToast('Nenhum campo foi identificado no texto.', 'warning');
    }
  }

  private showToast(text: string, type: 'success' | 'warning' | 'error') {
    this.toastMessage.set({ text, type });
    setTimeout(() => this.toastMessage.set(null), 3500);
  }
}