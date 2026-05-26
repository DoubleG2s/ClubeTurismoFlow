import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, signal, inject,
  forwardRef, HostListener, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, filter } from 'rxjs/operators';
import { BrasilApiService, BrasilCity } from '../../../services/brasil-api.service';

@Component({
  selector: 'app-city-autocomplete',
  standalone: true,
  imports: [CommonModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => CityAutocompleteComponent),
    multi: true
  }],
  templateUrl: './city-autocomplete.component.html'
})
export class CityAutocompleteComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() placeholder = 'Buscar cidade...';
  @Input() cssClass = '';
  @Output() citySelected = new EventEmitter<BrasilCity>();

  value = '';
  suggestions = signal<BrasilCity[]>([]);
  isLoading = signal(false);
  isOpen = signal(false);
  activeIndex = signal(-1);
  errorMessage = signal('');

  private searchSubject = new Subject<string>();
  private subscription: Subscription | null = null;
  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  private brasilApi = inject(BrasilApiService);
  private elRef = inject(ElementRef);

  ngOnInit() {
    this.subscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(term => {
        if (term.length < 3) {
          this.suggestions.set([]);
          this.isOpen.set(false);
          this.isLoading.set(false);
          return;
        }
        this.isLoading.set(true);
        this.isOpen.set(true);
        this.errorMessage.set('');
      }),
      filter(term => term.length >= 3),
      switchMap(term => this.brasilApi.searchCities(term))
    ).subscribe({
      next: (cities) => {
        this.suggestions.set(cities);
        this.isLoading.set(false);
        this.activeIndex.set(-1);
      },
      error: () => {
        this.suggestions.set([]);
        this.isLoading.set(false);
        this.errorMessage.set('Não foi possível carregar sugestões');
      }
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.searchSubject.complete();
  }

  // --- ControlValueAccessor ---

  writeValue(val: string): void {
    this.value = val || '';
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  // --- Input handlers ---

  onInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.value = term;
    this.onChange(term);
    this.searchSubject.next(term);
  }

  onFocus(): void {
    if (this.value.length >= 3 && this.suggestions().length > 0) {
      this.isOpen.set(true);
    }
  }

  onBlur(): void {
    this.onTouched();
    setTimeout(() => this.isOpen.set(false), 200);
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.suggestions();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(i => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => Math.max(i - 1, -1));
        break;
      case 'Enter':
        event.preventDefault();
        const idx = this.activeIndex();
        if (idx >= 0 && idx < items.length) {
          this.selectCity(items[idx]);
        }
        break;
      case 'Escape':
        this.isOpen.set(false);
        break;
    }
  }

  selectCity(city: BrasilCity): void {
    this.value = city.nome;
    this.onChange(city.nome);
    this.citySelected.emit(city);
    this.isOpen.set(false);
    this.suggestions.set([]);
  }

  highlightMatch(text: string): string {
    if (!this.value || this.value.length < 3) return text;
    const escaped = this.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<strong class="text-blue-600">$1</strong>');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
