import { Component, EventEmitter, Input, Output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Quote } from '../../models/quote';

@Component({
  selector: 'app-quote-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './quote-form.component.html',
})
export class QuoteFormComponent implements OnInit {
  @Input() quoteToEdit: Quote | null = null;
  @Input() isLoading = false; // Novo input para controlar estado do botão

  @Output() save = new EventEmitter<Omit<Quote, 'id' | 'created_at'>>();
  @Output() update = new EventEmitter<{ id: string, data: Partial<Quote> }>();
  @Output() cancel = new EventEmitter<void>();

  quoteForm: FormGroup;
  isEditMode = signal(false);

  constructor(private fb: FormBuilder) {
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

      // Voos (Nested Group)
      flight_details: this.fb.group({
        outbound: this.fb.group({
          origin_city: ['', Validators.required],
          destination_city: ['', Validators.required],
          departure_time: ['', Validators.required],
          arrival_time: ['', Validators.required]
        }),
        inbound: this.fb.group({
          origin_city: ['', Validators.required],
          destination_city: ['', Validators.required],
          departure_time: ['', Validators.required],
          arrival_time: ['', Validators.required]
        })
      }),

      // Hotéis (Form Array)
      hotel_options: this.fb.array([])
    });
  }

  get hotelOptions() {
    return this.quoteForm.get('hotel_options') as FormArray;
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
        flight_details: this.quoteToEdit.flight_details
      });

      // Handle Hotel Options Array
      if (this.quoteToEdit.hotel_options && this.quoteToEdit.hotel_options.length > 0) {
        this.quoteToEdit.hotel_options.forEach(hotel => {
          this.addHotelOption(hotel);
        });
      } else {
        this.addHotelOption(); // Ensure at least one
      }
    } else {
      this.addHotelOption(); // Start with one option for new quotes
    }
  }

  createHotelOptionGroup(data?: any): FormGroup {
    return this.fb.group({
      hotel_name: [data?.hotel_name || '', Validators.required],
      regime: [data?.regime || '', Validators.required],
      accommodation: [data?.accommodation || '', Validators.required],
      amount: [data?.amount || 0, [Validators.required, Validators.min(0.01)]],
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

  // Método público para ser chamado pelo pai após sucesso
  resetForm() {
    this.quoteForm.reset({
      adults: 2,
      children: 0,
      flight_details: {
        outbound: { origin_city: '', destination_city: '', departure_time: '', arrival_time: '' },
        inbound: { origin_city: '', destination_city: '', departure_time: '', arrival_time: '' }
      }
    });
    this.hotelOptions.clear();
    this.addHotelOption();
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

    // Access nested control safely
    this.quoteForm.get('flight_details')?.get(groupName)?.get(controlName)?.setValue(value);
  }

  onSubmit() {
    if (this.quoteForm.valid) {
      const formData = this.quoteForm.value;

      if (this.isEditMode() && this.quoteToEdit) {
        this.update.emit({
          id: this.quoteToEdit.id,
          data: formData
        });
      } else {
        // Emitimos o evento, mas NÃO resetamos aqui.
        // O pai chama resetForm() apenas se o backend confirmar o sucesso.
        this.save.emit(formData);
      }
    } else {
      console.log('Formulário Inválido', this.quoteForm.errors);
      this.quoteForm.markAllAsTouched();
      alert('Por favor, preencha todos os campos obrigatórios (incluindo voos e hotéis).');
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}