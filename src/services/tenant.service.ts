import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  // Mock temporário para Fase 1: ID da Clube Turismo Jardinópolis
  private readonly DEFAULT_COMPANY_ID = 'c8f1ad5f-0828-4aa2-9b2a-e75b7e2b8dd4';

  private currentCompanyIdSource = new BehaviorSubject<string | null>(this.DEFAULT_COMPANY_ID);
  currentCompanyId$ = this.currentCompanyIdSource.asObservable();

  constructor() {}

  /**
   * Obtém o company_id ativo no momento (síncrono).
   */
  getCurrentCompanyId(): string | null {
    return this.currentCompanyIdSource.value;
  }

  /**
   * Atualiza o company_id ativo.
   */
  setCompanyId(companyId: string) {
    this.currentCompanyIdSource.next(companyId);
  }

  /**
   * Limpa o company_id (útil para logout).
   */
  clearCompanyId() {
    this.currentCompanyIdSource.next(null);
  }

  /**
   * Retorna um objeto pré-formatado com o company_id para ser espalhado (spread) em payloads.
   * Exemplo: const payload = { ...dados, ...this.tenantService.getCompanyPayload() }
   */
  getCompanyPayload(): { company_id: string } | {} {
    const id = this.getCurrentCompanyId();
    return id ? { company_id: id } : {};
  }
}
