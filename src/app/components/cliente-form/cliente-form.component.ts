import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap } from 'rxjs/operators';
import { CLIENTE_TAG_OPTIONS, Cliente, ClienteFormValue, ClienteTag } from '../../models/cliente';
import { MaskDirective } from '../../shared/directives/mask.directive';
import { BrValidators } from '../../shared/validators/br-validators';
import { onlyDigits } from '../../shared/utils/br-masks';
import { BrasilApiService } from '../../services/brasil-api.service';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaskDirective],
  templateUrl: './cliente-form.component.html'
})
export class ClienteFormComponent implements OnInit, OnChanges, OnDestroy {
  private fb = inject(FormBuilder);
  private brasilApi = inject(BrasilApiService);
  private cepSubscription: Subscription | null = null;

  @Input() cliente: Cliente | null = null;
  @Input() existingClientes: Cliente[] = [];
  @Input() submitLabel = 'Salvar Cliente';
  @Input() showCancel = false;
  @Input() isSaving = false;

  @Output() save = new EventEmitter<ClienteFormValue>();
  @Output() cancel = new EventEmitter<void>();

  readonly ufOptions = UFS;
  readonly tagOptions = CLIENTE_TAG_OPTIONS;

  selectedTags = signal<ClienteTag[]>([]);
  isCepLoading = signal(false);
  cepNotFound = signal(false);

  form: FormGroup = this.fb.group({
    full_name: ['', [Validators.required, Validators.minLength(3)]],
    cpf: ['', [BrValidators.cpfCnpj()]],
    rg: [''],
    birth_date: ['', [BrValidators.birthDate()]],
    gender: [''],
    email: ['', [Validators.email]],
    phone_number: ['', [BrValidators.phone()]],
    whatsapp_number: ['', [BrValidators.phone()]],
    zip_code: ['', [BrValidators.cep()]],
    address_street: [''],
    address_number: [''],
    address_complement: [''],
    address_district: [''],
    address_city: [''],
    address_state: [''],
    customer_since: [String(new Date().getFullYear())],
    notes: ['']
  });

  duplicateCpfName = computed(() => {
    const cpf = onlyDigits(this.form.get('cpf')?.value);
    if (cpf.length < 11) return null;
    const dup = this.existingClientes.find(c => c.id !== this.cliente?.id && onlyDigits(c.cpf) === cpf);
    return dup ? dup.full_name : null;
  });

  ngOnInit() {
    this.cepSubscription = this.form.get('zip_code')!.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      tap(value => {
        if (onlyDigits(value).length !== 8) this.cepNotFound.set(false);
      }),
      filter(value => onlyDigits(value).length === 8),
      switchMap(value => {
        this.isCepLoading.set(true);
        this.cepNotFound.set(false);
        return this.brasilApi.searchCep(value);
      })
    ).subscribe(result => {
      this.isCepLoading.set(false);

      if (!result) {
        this.cepNotFound.set(true);
        return;
      }

      this.form.patchValue({
        address_street: result.street || this.form.get('address_street')?.value,
        address_district: result.neighborhood || this.form.get('address_district')?.value,
        address_city: result.city || '',
        address_state: result.state || ''
      });
    });
  }

  ngOnDestroy() {
    this.cepSubscription?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cliente']) {
      if (this.cliente) {
        this.form.patchValue({
          full_name: this.cliente.full_name,
          cpf: this.cliente.cpf || '',
          rg: this.cliente.rg || '',
          birth_date: this.cliente.birth_date || '',
          gender: this.cliente.gender || '',
          email: this.cliente.email || '',
          phone_number: this.cliente.phone_number || '',
          whatsapp_number: this.cliente.whatsapp_number || '',
          zip_code: this.cliente.zip_code || '',
          address_street: this.cliente.address_street || '',
          address_number: this.cliente.address_number || '',
          address_complement: this.cliente.address_complement || '',
          address_district: this.cliente.address_district || '',
          address_city: this.cliente.address_city || '',
          address_state: this.cliente.address_state || '',
          customer_since: this.cliente.customer_since || String(new Date().getFullYear()),
          notes: this.cliente.notes || ''
        });
        this.selectedTags.set([...(this.cliente.tags || [])]);
      } else {
        this.resetForm();
      }
    }
  }

  toggleTag(tag: ClienteTag) {
    this.selectedTags.update(tags =>
      tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]
    );
  }

  resetForm() {
    this.form.reset({ customer_since: String(new Date().getFullYear()) });
    this.selectedTags.set([]);
  }

  onSubmit() {
    if (this.form.invalid || this.duplicateCpfName()) {
      this.form.markAllAsTouched();
      return;
    }

    this.save.emit({
      ...this.form.getRawValue(),
      tags: this.selectedTags()
    } as ClienteFormValue);
  }
}
