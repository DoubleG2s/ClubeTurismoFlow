import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private authService = inject(AuthService);

  constructor() { }

  /**
   * Obtém o company_id dinamicamente com base no perfil do usuário logado do AuthService.
   * Quando o RLS está ativo, os Agentes devem enviar o company_id deles nos INSERTS.
   * Se for Administrador e não tiver company_id fixo, os inserts ficarão sem, ou podem ser gerenciados.
   */
  getCurrentCompanyId(): string | null {
    const profile = this.authService.profile();
    return profile?.company_id || null;
  }

  /**
   * Retorna um objeto pré-formatado com o company_id para ser espalhado (spread) em payloads.
   * Utilizado em Create/Insert endpoints dos Services.
   */
  getCompanyPayload(): { company_id: string } | {} {
    const id = this.getCurrentCompanyId();
    if (!id) {
      // Em vez de retornar {}, jogamos um erro ou logamos, 
      // pois não deve existir insert sem empresa em um sistema multi-tenant.
      throw new Error('Tentativa de criar registro sem um Company ID ativo.');
    }
    return { company_id: id };
  }
}
