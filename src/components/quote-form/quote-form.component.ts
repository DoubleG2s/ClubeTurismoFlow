import { Component, EventEmitter, Input, Output, OnInit, SimpleChanges, OnChanges, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Quote } from '../../models/quote';
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

  quoteForm!: FormGroup; // Definite assignment
  isEditMode = signal(false);

  // States do Autocomplete
  hotelService = inject(HotelService);
  activeHotelDropdownIndex = signal<number | null>(null);

  // Injeção do ChangeDetectorRef para garantir atualização da UI após recriar o form
  private cdr = inject(ChangeDetectorRef);

  constructor(private fb: FormBuilder) {
    this.initForm();
  }

  // Método para criar/recriar a estrutura limpa do formulário
  private initForm() {
    this.quoteForm = this.fb.group({
      // Campos principais
      title: ['', Validators.required],
      subtitle: [''],
      supplier: ['', Validators.required],

      // Datas e Pax
      check_in: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      check_out: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      adults: [2, [Validators.required, Validators.min(1)]],
      children: [0, [Validators.required, Validators.min(0)]],

      // Detalhes Gerais
      tour_details: [''], // Passeio (opcional)
      has_transfer: [false], // Traslado chegada e saída

      // Voos (Nested Group)
      flight_details: this.fb.group({
        outbound: this.fb.group({
          origin_city: ['', Validators.required],
          destination_city: ['', Validators.required],
          departure_time: ['', Validators.required],
          arrival_time: ['', Validators.required],
          has_connection: [false],
          connection_city: [''],
          connection_time: ['']
        }),
        inbound: this.fb.group({
          origin_city: ['', Validators.required],
          destination_city: ['', Validators.required],
          departure_time: ['', Validators.required],
          arrival_time: ['', Validators.required],
          has_connection: [false],
          connection_city: [''],
          connection_time: ['']
        })
      }),

      // Hotéis (Form Array)
      hotel_options: this.fb.array([])
    });

    // Adiciona uma opção de hotel vazia por padrão
    this.addHotelOption();
  }

  get hotelOptions() {
    return this.quoteForm.get('hotel_options') as FormArray;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['prefillData'] && this.prefillData && !this.isEditMode()) {
       this.quoteForm.patchValue({
         title: this.prefillData.title || '',
         adults: this.prefillData.adults || 2,
         children: this.prefillData.children || 0
       });
    }
  }

  ngOnInit() {
    if (this.quoteToEdit) {
      this.isEditMode.set(true);

      // Patch simple fields
      this.quoteForm.patchValue({
        title: this.quoteToEdit.title,
        subtitle: this.quoteToEdit.subtitle,
        supplier: this.quoteToEdit.supplier,
        check_in: this.quoteToEdit.check_in,
        check_out: this.quoteToEdit.check_out,
        adults: this.quoteToEdit.adults,
        children: this.quoteToEdit.children,
        tour_details: this.quoteToEdit.tour_details,
        has_transfer: this.quoteToEdit.has_transfer || false,
        flight_details: this.quoteToEdit.flight_details
      });

      // Handle Hotel Options Array - Limpa o default criado pelo initForm
      this.hotelOptions.clear();

      if (this.quoteToEdit.hotel_options && this.quoteToEdit.hotel_options.length > 0) {
        this.quoteToEdit.hotel_options.forEach(hotel => {
          // Converte o valor numérico do banco para string formatada
          const formattedAmount = this.formatNumberToString(hotel.amount);
          this.addHotelOption({ ...hotel, amount: formattedAmount });
        });
      } else {
        this.addHotelOption();
      }
    }
    // Se não for edição, o initForm já configurou o estado inicial corretamente
  }

  createHotelOptionGroup(data?: any): FormGroup {
    return this.fb.group({
      hotel_id: [data?.hotel_id || ''],
      hotel_images: [data?.hotel_images || []],
      hotel_name: [data?.hotel_name || '', Validators.required],
      regime: [data?.regime || '', Validators.required],
      accommodation: [data?.accommodation || '', Validators.required],
      // Amount inicia como string para suportar mascara
      amount: [data?.amount || '', Validators.required],
      currency: [data?.currency || 'BRL', Validators.required],
      link: [data?.link || '']
    });
  }

  addHotelOption(data?: any) {
    this.hotelOptions.push(this.createHotelOptionGroup(data));
  }

  removeHotelOption(index: number) {
    if (this.hotelOptions.length > 1) {
      this.hotelOptions.removeAt(index);
    }
  }

  // --- AUTOCOMPLETE HOTÉIS ---

  getFilteredHotels(index: number): Hotel[] {
    const term = this.hotelOptions.at(index).get('hotel_name')?.value?.toLowerCase() || '';
    const allHotels = this.hotelService.hotels();
    if (!term) return allHotels;
    return allHotels.filter(h => h.name.toLowerCase().includes(term));
  }

  selectHotelFromSearch(index: number, hotel: Hotel) {
    const images = hotel.hotel_images ? hotel.hotel_images.map(img => img.image_url) : [];
    this.hotelOptions.at(index).patchValue({
      hotel_id: hotel.id,
      hotel_name: hotel.name,
      hotel_images: images
    });
    this.activeHotelDropdownIndex.set(null);
  }

  onHotelBlur() {
    // Delay pequeno para permitir o clique na lista
    setTimeout(() => this.activeHotelDropdownIndex.set(null), 200);
  }

  openHotelCreation(index: number) {
     const term = this.hotelOptions.at(index).get('hotel_name')?.value || '';
     // O app usa estado na querystring sem Angular router
     window.open(`/?tab=hotel&new=${encodeURIComponent(term)}`, '_blank');
  }

  // --- MÁSCARA MONETÁRIA ---

  // Converte número 1234.56 -> "1.234,56"
  private formatNumberToString(value: number): string {
    if (value === undefined || value === null) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Evento de input para aplicar máscara em tempo real
  onCurrencyInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não é dígito

    if (!value) {
      this.hotelOptions.at(index).get('amount')?.setValue('');
      return;
    }

    // Divide por 100 para considerar os centavos
    const floatValue = parseFloat(value) / 100;

    // Formata para pt-BR
    const formatted = floatValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    input.value = formatted;
    this.hotelOptions.at(index).get('amount')?.setValue(formatted);
  }

  // Converte string "1.234,56" -> number 1234.56 para salvar
  private parseCurrencyString(value: string): number {
    if (!value) return 0;
    // Remove pontos de milhar e substitui vírgula por ponto
    const cleanValue = value.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue);
  }

  // -------------------------

  resetForm() {
    this.isEditMode.set(false);
    this.initForm(); // Destrói e recria os controles para limpar flags de validação
    this.cdr.markForCheck(); // Garante que a UI atualize o estado disabled do botão
  }

  onDateInput(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length >= 5) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4);
    } else if (value.length >= 3) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    input.value = value;
    this.quoteForm.get(controlName)?.setValue(value);
  }

  onTimeInput(event: Event, groupName: string, controlName: string) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 3) {
      value = value.slice(0, 2) + ':' + value.slice(2);
    }
    input.value = value;

    this.quoteForm.get('flight_details')?.get(groupName)?.get(controlName)?.setValue(value);
  }

  onSubmit() {
    if (this.quoteForm.valid) {
      const formValue = this.quoteForm.value;

      // PREPARAÇÃO DOS DADOS: Converter amounts de string para number
      const processedHotels = formValue.hotel_options.map((hotel: any) => ({
        ...hotel,
        amount: typeof hotel.amount === 'string' ? this.parseCurrencyString(hotel.amount) : hotel.amount
      }));

      const finalPayload = {
        ...formValue,
        hotel_options: processedHotels
      };

      if (this.isEditMode() && this.quoteToEdit) {
        this.update.emit({
          id: this.quoteToEdit.id,
          data: finalPayload
        });
      } else {
        this.save.emit(finalPayload);
        // O reset é chamado pelo componente pai (AppComponent) após sucesso
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