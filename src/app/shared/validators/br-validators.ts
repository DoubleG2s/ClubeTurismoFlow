import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { onlyDigits } from '../utils/br-masks';

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let checkDigit1 = 11 - (sum % 11);
  if (checkDigit1 >= 10) checkDigit1 = 0;
  if (checkDigit1 !== parseInt(cpf[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let checkDigit2 = 11 - (sum % 11);
  if (checkDigit2 >= 10) checkDigit2 = 0;
  return checkDigit2 === parseInt(cpf[10], 10);
}

function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calcCheckDigit = (base: string): number => {
    let pos = base.length - 7;
    let sum = 0;
    for (let i = base.length; i >= 1; i--) {
      sum += parseInt(base[base.length - i], 10) * pos--;
      if (pos < 2) pos = 9;
    }
    const result = sum % 11;
    return result < 2 ? 0 : 11 - result;
  };

  const digit1 = calcCheckDigit(cnpj.slice(0, 12));
  if (digit1 !== parseInt(cnpj[12], 10)) return false;

  const digit2 = calcCheckDigit(cnpj.slice(0, 13));
  return digit2 === parseInt(cnpj[13], 10);
}

function isValidBirthDate(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) return false;

  return year >= today.getFullYear() - 120;
}

export class BrValidators {
  static cpfCnpj(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const digits = onlyDigits(control.value);
      if (!digits) return null;

      const valid = digits.length === 11 ? isValidCpf(digits) : digits.length === 14 ? isValidCnpj(digits) : false;
      return valid ? null : { cpfCnpj: true };
    };
  }

  static phone(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const digits = onlyDigits(control.value);
      if (!digits) return null;

      return digits.length === 10 || digits.length === 11 ? null : { phone: true };
    };
  }

  static cep(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const digits = onlyDigits(control.value);
      if (!digits) return null;

      return digits.length === 8 ? null : { cep: true };
    };
  }

  static birthDate(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value || '').trim();
      if (!value) return null;

      return isValidBirthDate(value) ? null : { birthDate: true };
    };
  }
}
