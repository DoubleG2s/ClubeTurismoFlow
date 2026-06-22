import {
  Component, Input, OnInit, OnDestroy, signal, inject, forwardRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, filter } from 'rxjs/operators';
import { AirportService } from '../../../services/airport.service';

type LookupState = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

@Component({
  selector: 'app-iata-airport-input',
  standalone: true,
  imports: [CommonModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => IataAirportInputComponent),
    multi: true
  }],
  templateUrl: './iata-airport-input.component.html'
})
export class IataAirportInputComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() placeholder = 'Sigla IATA ou cidade...';
  @Input() cssClass = '';

  value = '';
  lookupState = signal<LookupState>('idle');

  private searchSubject = new Subject<string>();
  private subscription: Subscription | null = null;
  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  private airportService = inject(AirportService);

  ngOnInit() {
    this.subscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      filter(term => term.length === 3),
      switchMap(term => this.airportService.getAirportByIata(term))
    ).subscribe({
      next: (city) => {
        if (city) {
          this.value = city;
          this.onChange(city);
          this.lookupState.set('found');
        } else {
          this.lookupState.set('not_found');
        }
      },
      error: () => {
        this.lookupState.set('error');
      }
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.searchSubject.complete();
  }

  writeValue(val: string): void {
    this.value = val || '';
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const upper = raw.toUpperCase();
    (event.target as HTMLInputElement).value = upper;
    this.value = upper;
    this.onChange(upper);

    if (upper.length === 3) {
      this.lookupState.set('loading');
    } else {
      this.lookupState.set('idle');
    }

    this.searchSubject.next(upper);
  }

  onBlur(): void {
    this.onTouched();
  }
}
