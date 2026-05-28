import { Component, EventEmitter, Output, Input, OnInit, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Reservation, ProductType } from '../../models/reservation';
import { CityAutocompleteComponent } from '../shared/city-autocomplete/city-autocomplete.component';
import { AiVoucherService } from '../../services/ai-voucher.service';
import { HotelService } from '../../services/hotel.service';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CityAutocompleteComponent],
  templateUrl: './reservation-form.component.html',
})
export class ReservationFormComponent implements OnInit {
  @Input() reservationToEdit: Reservation | null = null;
  @Input() set prefillData(data: Partial<Reservation> | null) {
    if (data && !this.isEditMode() && this.reservationForm) {
      this.reservationForm.patchValue({
         destination: data.destination || '',
         date: data.date || '',
         return_date: (data as any).return_date || '',
         reservation_number: (data as any).reservation_number || '',
         notes: (data as any).notes || '',
         // Novos campos flat
         product_type: data.product_type || ProductType.PACOTE,
         supplier: data.supplier || '',
         flight_voucher: data.flight_voucher || '',
         airline: data.airline || '',
         origin: data.origin || '',
         nome_hotel: data.nome_hotel || '',
         quarto: data.quarto || '',
         regime_alimentacao: data.regime_alimentacao || '',
         localizador_hotel: data.localizador_hotel || '',
         cruise_company: data.cruise_company || '',
         ship_name: data.ship_name || '',
         cabin: data.cabin || ''
       });
       const px = (data as any).passengers;
       if (px && Array.isArray(px) && px.length > 0) {
         const validPassengers = px.filter(p => typeof p === 'string' && p.trim().length > 0);
         if (validPassengers.length > 0) {
           while (this.passengers.length > validPassengers.length) {
             this.passengers.removeAt(this.passengers.length - 1);
           }
           validPassengers.forEach((p: string, index: number) => {
             if (index < this.passengers.length) {
               this.passengers.at(index).setValue(p.trim());
             } else {
               this.addPassenger();
               this.passengers.at(index).setValue(p.trim());
             }
           });
         }
       }
       
       this.cdr.markForCheck(); // Ensure reactive updates to UI
    }
  }
  @Output() save = new EventEmitter<Omit<Reservation, 'id' | 'created_at'>>();
  @Output() update = new EventEmitter<{ id: string, data: Partial<Reservation> }>();
  @Output() cancel = new EventEmitter<void>();

  reservationForm!: FormGroup; // Definite assignment assertion
  isEditMode = signal(false);
  isExtracting = signal(false);
  extractionWarning = signal<string | null>(null);

  productTypes = [
    { value: ProductType.PACOTE, label: 'Pacote de Viagem' },
    { value: ProductType.VOO, label: 'Somente Voo' },
    { value: ProductType.HOSPEDAGEM, label: 'Somente Hospedagem' },
    { value: ProductType.CRUZEIRO, label: 'Cruzeiro Marítimo' },
  ];

  // Inject ChangeDetectorRef for Zoneless updates
  private cdr = inject(ChangeDetectorRef);
  private aiVoucherService = inject(AiVoucherService);
  public hotelService = inject(HotelService);

  constructor(private fb: FormBuilder) {
    this.initForm();
  }

  // Method to build/rebuild the form structure from scratch
  private initForm() {
    this.reservationForm = this.fb.group({
      product_type: [ProductType.PACOTE, Validators.required],
      supplier: [''],
      reservation_number: ['', Validators.required],
      destination: ['', Validators.required],
      date: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      return_date: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      flight_voucher: [''],
      airline: [''],
      origin: [''],
      nome_hotel: [''],
      quarto: [''],
      regime_alimentacao: [''],
      localizador_hotel: [''],
      cruise_company: [''],
      ship_name: [''],
      cabin: [''],
      passengers: this.fb.array([this.createPassengerControl()]),
      notes: ['']
    });
  }
  // Removing ngOnChanges as we're utilizing setter for prefill data now
  ngOnInit() {
    if (this.reservationToEdit) {
      this.isEditMode.set(true);

      this.reservationForm.patchValue({
        product_type: this.reservationToEdit.product_type || ProductType.PACOTE,
        supplier: this.reservationToEdit.supplier || '',
        reservation_number: this.reservationToEdit.reservation_number,
        destination: this.reservationToEdit.destination || '',
        date: this.reservationToEdit.date,
        return_date: this.reservationToEdit.return_date || '',
        flight_voucher: this.reservationToEdit.flight_voucher || '',
        airline: this.reservationToEdit.airline || '',
        origin: this.reservationToEdit.origin || '',
        nome_hotel: this.reservationToEdit.nome_hotel || '',
        quarto: this.reservationToEdit.quarto || '',
        regime_alimentacao: this.reservationToEdit.regime_alimentacao || '',
        localizador_hotel: this.reservationToEdit.localizador_hotel || '',
        cruise_company: this.reservationToEdit.cruise_company || '',
        ship_name: this.reservationToEdit.ship_name || '',
        cabin: this.reservationToEdit.cabin || '',
        notes: this.reservationToEdit.notes || ''
      });

      // Handle Passengers FormArray
      if (this.reservationToEdit.passengers && this.reservationToEdit.passengers.length > 0) {
        while (this.passengers.length > this.reservationToEdit.passengers.length) {
          this.passengers.removeAt(this.passengers.length - 1);
        }
        this.reservationToEdit.passengers.forEach((p, index) => {
          if (index < this.passengers.length) {
            this.passengers.at(index).setValue(p);
          } else {
            this.addPassenger();
            this.passengers.at(index).setValue(p);
          }
        });
      } else {
        if (this.passengers.length === 0) {
          this.addPassenger();
        }
      }
    }
  }

  get selectedProductType(): ProductType {
    return this.reservationForm?.get('product_type')?.value;
  }

  get passengers() {
    return this.reservationForm.get('passengers') as FormArray;
  }

  createPassengerControl() {
    return this.fb.control('', Validators.required);
  }

  addPassenger() {
    this.passengers.push(this.createPassengerControl());
  }

  removePassenger(index: number) {
    if (this.passengers.length > 1) {
      this.passengers.removeAt(index);
    }
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

    // Ensure value propagation
    this.reservationForm.get(controlName)?.setValue(value);
  }

  onVoucherInput(event: Event, controlName: string = 'flight_voucher') {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase();
    if (value.length > 6) value = value.slice(0, 6);

    input.value = value;
    this.reservationForm.get(controlName)?.setValue(value);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    if (file.type !== 'application/pdf') {
      alert('Por favor, selecione um arquivo PDF.');
      return;
    }

    this.isExtracting.set(true);
    this.extractionWarning.set(null);
    this.cdr.markForCheck();

    try {
      const extracted = await this.aiVoucherService.processVoucher(file);
      
      let warnings = [];
      if (!extracted.destino) warnings.push('Destino não encontrado.');
      if (extracted.passageiros.length === 0) warnings.push('Nenhum passageiro encontrado.');
      if (!extracted.data_ida) warnings.push('Data de ida não encontrada.');
      if (extracted.voo_voucher && extracted.voo_voucher.length !== 6) warnings.push('Localizador de voo fora do padrão.');
      
      if (warnings.length > 0) {
        this.extractionWarning.set('Atenção: ' + warnings.join(' '));
      }

      this.reservationForm.patchValue({
        product_type: extracted.product_type || this.reservationForm.get('product_type')?.value,
        destination: extracted.destino || this.reservationForm.get('destination')?.value,
        date: extracted.data_ida || this.reservationForm.get('date')?.value,
        return_date: extracted.data_volta || this.reservationForm.get('return_date')?.value,
        reservation_number: extracted.reserva_voucher || this.reservationForm.get('reservation_number')?.value,
        flight_voucher: extracted.voo_voucher || this.reservationForm.get('flight_voucher')?.value,
        nome_hotel: extracted.hotel_nome || this.reservationForm.get('nome_hotel')?.value,
        localizador_hotel: extracted.hotel_localizador || this.reservationForm.get('localizador_hotel')?.value,
        notes: extracted.notes_prefill || this.reservationForm.get('notes')?.value
      });

      if (extracted.passageiros.length > 0) {
        while (this.passengers.length > extracted.passageiros.length) {
          this.passengers.removeAt(this.passengers.length - 1);
        }
        extracted.passageiros.forEach((p: string, index: number) => {
          if (index < this.passengers.length) {
            this.passengers.at(index).setValue(p);
          } else {
            this.addPassenger();
            this.passengers.at(index).setValue(p);
          }
        });
      }

    } catch (err: any) {
      alert(err.message || 'Erro ao processar o voucher.');
    } finally {
      this.isExtracting.set(false);
      input.value = '';
      this.cdr.markForCheck();
    }
  }

  onSubmit() {
    if (this.reservationForm.valid) {
      const formValue = this.reservationForm.value;

      // Enforce uppercase locator
      if (formValue.flight_voucher) {
         formValue.flight_voucher = formValue.flight_voucher.toUpperCase();
      }

      const payload = {
        product_type: formValue.product_type,
        supplier: formValue.supplier,
        reservation_number: formValue.reservation_number,
        destination: formValue.destination,
        date: formValue.date,
        return_date: formValue.return_date,
        flight_voucher: formValue.flight_voucher || null,
        airline: formValue.airline || null,
        origin: formValue.origin || null,
        nome_hotel: formValue.nome_hotel || null,
        quarto: formValue.quarto || null,
        regime_alimentacao: formValue.regime_alimentacao || null,
        localizador_hotel: formValue.localizador_hotel || null,
        cruise_company: formValue.cruise_company || null,
        ship_name: formValue.ship_name || null,
        cabin: formValue.cabin || null,
        passengers: formValue.passengers,
        notes: formValue.notes
      };

      if (this.isEditMode() && this.reservationToEdit) {
        this.update.emit({
          id: this.reservationToEdit.id,
          data: payload
        });
      } else {
        const newReservation: Omit<Reservation, 'id' | 'created_at'> = {
          ...payload,
          checklist: {
            contract: false,
            payment: false,
            flight_registered: false,
            hotel_confirmed: false,
            checkin_outbound: false,
            checkin_inbound: false,
            hotel_email: false,
            seats_assigned: false,
            seats_assigned_inbound: false,
            contract_signed: false,
            voucher_sent: false,
            post_trip: false // Added
          }
        };

        this.save.emit(newReservation);

        // CRITICAL FIX: Destroy and Re-create the form instance.
        this.initForm();
        this.cdr.markForCheck();
      }
    } else {
      this.reservationForm.markAllAsTouched();
    }
  }

  onCancel() {
    this.cancel.emit();
    this.initForm();
    this.cdr.markForCheck();
  }
}