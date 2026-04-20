import { Component, EventEmitter, Output, Input, OnInit, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Reservation } from '../../models/reservation';
import { CityAutocompleteComponent } from '../shared/city-autocomplete/city-autocomplete.component';

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
         flight_voucher: (data as any).flight_voucher || '',
         reservation_number: (data as any).reservation_number || '',
         notes: (data as any).notes || ''
       });
       
       const px = (data as any).passengers;
       if (px && Array.isArray(px) && px.length > 0) {
         const validPassengers = px.filter(p => typeof p === 'string' && p.trim().length > 0);
         if (validPassengers.length > 0) {
           this.passengers.clear();
           validPassengers.forEach((p: string) => {
             this.passengers.push(this.fb.control(p.trim(), Validators.required));
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

  // Inject ChangeDetectorRef for Zoneless updates
  private cdr = inject(ChangeDetectorRef);

  constructor(private fb: FormBuilder) {
    this.initForm();
  }

  // Method to build/rebuild the form structure from scratch
  private initForm() {
    this.reservationForm = this.fb.group({
      reservation_number: ['', Validators.required],
      destination: ['', Validators.required],
      date: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      // return_date e flight_voucher agora são OBRIGATÓRIOS
      return_date: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      flight_voucher: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
      passengers: this.fb.array([this.createPassengerControl()]),
      notes: ['']
    });
  }
  // Removing ngOnChanges as we're utilizing setter for prefill data now
  ngOnInit() {
    if (this.reservationToEdit) {
      this.isEditMode.set(true);

      this.reservationForm.patchValue({
        reservation_number: this.reservationToEdit.reservation_number,
        destination: this.reservationToEdit.destination || '',
        date: this.reservationToEdit.date,
        return_date: this.reservationToEdit.return_date || '',
        flight_voucher: this.reservationToEdit.flight_voucher || '',
        notes: this.reservationToEdit.notes || ''
      });

      // Handle Passengers FormArray
      this.passengers.clear();
      if (this.reservationToEdit.passengers && this.reservationToEdit.passengers.length > 0) {
        this.reservationToEdit.passengers.forEach(p => {
          this.passengers.push(this.fb.control(p, Validators.required));
        });
      } else {
        this.addPassenger();
      }
    }
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

  onVoucherInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase();
    if (value.length > 6) value = value.slice(0, 6);

    input.value = value;
    this.reservationForm.get('flight_voucher')?.setValue(value);
  }

  onSubmit() {
    if (this.reservationForm.valid) {
      const formValue = this.reservationForm.value;

      // Validação extra
      if (formValue.flight_voucher && formValue.flight_voucher.length !== 6) {
        alert('O voucher deve ter exatamente 6 caracteres.');
        return;
      }

      const payload = {
        reservation_number: formValue.reservation_number,
        destination: formValue.destination,
        date: formValue.date,
        return_date: formValue.return_date, // Agora obrigatório
        flight_voucher: formValue.flight_voucher, // Agora obrigatório
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