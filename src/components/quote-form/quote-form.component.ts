import { Component, EventEmitter, Input, Output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Quote } from '../../models/quote';

@Component({
  selector: 'app-quote-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './quote-form.component.html',
})
export class QuoteFormComponent implements OnInit {
  @Input() quoteToEdit: Quote | null = null;
  @Output() save = new EventEmitter<Omit<Quote, 'id' | 'created_at'>>();
  @Output() update = new EventEmitter<{id: string, data: Partial<Quote>}>();
  @Output() cancel = new EventEmitter<void>();

  quoteForm: FormGroup;
  isEditMode = signal(false);
  
  // Controls display of formatted currency value in input
  displayValue = signal(''); 

  constructor(private fb: FormBuilder) {
    this.quoteForm = this.fb.group({
      supplier: ['', Validators.required],
      check_in: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      check_out: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
      hotel_name: ['', Validators.required],
      city: ['', Validators.required],
      accommodation_type: ['', Validators.required],
      adults: [2, [Validators.required, Validators.min(1)]],
      children: [0, [Validators.required, Validators.min(0)]],
      lead_name: [''],
      currency: ['BRL', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      notes: [''] // Added notes field
    });
  }

  ngOnInit() {
    if (this.quoteToEdit) {
      this.isEditMode.set(true);
      this.quoteForm.patchValue(this.quoteToEdit);
      this.updateDisplayValue(this.quoteToEdit.amount, this.quoteToEdit.currency);
    }
    
    // Listen to currency changes to reformat the display value
    this.quoteForm.get('currency')?.valueChanges.subscribe(curr => {
      const amount = this.quoteForm.get('amount')?.value;
      if (amount) this.updateDisplayValue(amount, curr);
    });
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

  // Handle Money Input Masking
  onAmountInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let rawValue = input.value.replace(/\D/g, '');
    
    // Handle empty
    if (!rawValue) {
        this.quoteForm.get('amount')?.setValue(0);
        this.displayValue.set('');
        return;
    }

    // Convert to number (cents to float)
    const numericValue = parseInt(rawValue, 10) / 100;
    this.quoteForm.get('amount')?.setValue(numericValue);

    // Format back to string for display
    const currency = this.quoteForm.get('currency')?.value;
    this.updateDisplayValue(numericValue, currency);
    
    // Force input value to match display
    // input.value = this.displayValue(); // Controlled by binding in template usually, but we use (input)
  }

  updateDisplayValue(value: number, currency: 'BRL' | 'USD') {
    if (currency === 'BRL') {
      this.displayValue.set(
        value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      );
    } else {
      this.displayValue.set(
        value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      );
    }
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
        this.save.emit(formData);
        this.quoteForm.reset({
          adults: 2, 
          children: 0, 
          currency: 'BRL',
          amount: 0,
          notes: ''
        });
        this.displayValue.set('');
      }
    } else {
      this.quoteForm.markAllAsTouched();
    }
  }

  onCancel() {
    this.cancel.emit();
    this.quoteForm.reset();
  }
}