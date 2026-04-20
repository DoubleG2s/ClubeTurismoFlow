import { Component, EventEmitter, Input, Output, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Flight } from '../../models/flight';

@Component({
  selector: 'app-flight-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './flight-form.component.html',
})
export class FlightFormComponent implements OnInit {
  @Input() flightToEdit: Flight | null = null;
  @Input() set prefillData(data: Partial<Flight> | null) {
    if (data && !this.isEditMode() && this.flightForm) {
      this.flightForm.patchValue({
        locator: data.locator || this.flightForm.get('locator')?.value || '',
        date: data.date || this.flightForm.get('date')?.value || '',
        return_date: data.return_date || this.flightForm.get('return_date')?.value || '',
        origin: data.origin || this.flightForm.get('origin')?.value || ''
      });
    }
  }
  @Output() save = new EventEmitter<Omit<Flight, 'id' | 'created_at' | 'confirmed'>>();
  @Output() update = new EventEmitter<{id: string, data: Partial<Flight>}>();
  @Output() cancel = new EventEmitter<void>();

  flightForm: FormGroup;
  isEditMode = signal(false);

  constructor(private fb: FormBuilder) {
    this.flightForm = this.fb.group({
      locator: ['', [Validators.required, Validators.maxLength(6), Validators.pattern(/^[A-Z0-9]*$/)]],
      origin: ['', Validators.required],
      date: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      return_date: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]]
    });
  }

  ngOnInit() {
    if (this.flightToEdit) {
      this.isEditMode.set(true);
      
      if (!this.flightToEdit.return_date) {
        this.flightForm.get('return_date')?.clearValidators();
        this.flightForm.get('return_date')?.addValidators([Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]);
      }

      this.flightForm.patchValue({
        locator: this.flightToEdit.locator,
        origin: this.flightToEdit.origin,
        date: this.flightToEdit.date,
        return_date: this.flightToEdit.return_date || ''
      });
    }
  }

  onLocatorInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase();
    if (value.length > 6) {
      value = value.slice(0, 6);
    }
    this.flightForm.get('locator')?.setValue(value, { emitEvent: false });
    input.value = value; 
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
    this.flightForm.get(controlName)?.setValue(value);
  }

  onSubmit() {
    if (this.flightForm.valid) {
      const formData = this.flightForm.value;
      
      if (this.isEditMode() && this.flightToEdit) {
        this.update.emit({
          id: this.flightToEdit.id,
          data: formData
        });
      } else {
        this.save.emit(formData);
        this.flightForm.reset();
      }
    } else {
      this.flightForm.markAllAsTouched();
    }
  }

  onCancel() {
    this.cancel.emit();
    this.flightForm.reset();
  }
}