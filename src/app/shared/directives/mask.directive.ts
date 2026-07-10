import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { maskBirthDate, maskCep, maskCpfCnpj, maskPhone } from '../utils/br-masks';

export type MaskType = 'cpfCnpj' | 'phone' | 'cep' | 'birthDate';

const MASK_FNS: Record<MaskType, (value: string) => string> = {
  cpfCnpj: maskCpfCnpj,
  phone: maskPhone,
  cep: maskCep,
  birthDate: maskBirthDate
};

@Directive({
  selector: '[appMask]',
  standalone: true
})
export class MaskDirective {
  @Input('appMask') maskType!: MaskType;

  private el = inject(ElementRef<HTMLInputElement>);
  private ngControl = inject(NgControl, { optional: true, self: true });

  @HostListener('input', ['$event'])
  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const maskFn = MASK_FNS[this.maskType];
    if (!maskFn) return;

    const masked = maskFn(input.value);
    input.value = masked;
    this.ngControl?.control?.setValue(masked, { emitEvent: false });
  }
}
