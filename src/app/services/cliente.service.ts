import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Observable, from } from 'rxjs';
import { Cliente, ClienteFormValue } from '../models/cliente';
import { supabase } from './supabase';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { formatInputDateToPtBr, formatPtBrDateToInputValue } from '../shared/utils/date.utils';
import { maskCep, maskCpfCnpj, maskPhone } from '../shared/utils/br-masks';

function mapRowToCliente(row: any): Cliente {
  return {
    id: row.id,
    full_name: row.full_name,
    cpf: row.cpf ? maskCpfCnpj(row.cpf) : undefined,
    rg: row.rg || undefined,
    birth_date: row.birth_date ? formatInputDateToPtBr(row.birth_date) : undefined,
    gender: row.gender || '',
    email: row.email || undefined,
    phone_number: row.phone_number ? maskPhone(row.phone_number) : undefined,
    whatsapp_number: row.whatsapp_number ? maskPhone(row.whatsapp_number) : undefined,
    zip_code: row.zip_code ? maskCep(row.zip_code) : undefined,
    address_street: row.address_street || undefined,
    address_number: row.address_number || undefined,
    address_complement: row.address_complement || undefined,
    address_district: row.address_district || undefined,
    address_city: row.address_city || undefined,
    address_state: row.address_state || undefined,
    tags: row.tags || [],
    customer_since: row.customer_since || undefined,
    notes: row.notes || undefined,
    trips: [], // TODO: alimentar via JOIN com a futura tabela de vendas (vendas.client_id)
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapClienteToRow(value: ClienteFormValue): Record<string, any> {
  return {
    full_name: value.full_name,
    cpf: value.cpf || null,
    rg: value.rg || null,
    birth_date: value.birth_date ? formatPtBrDateToInputValue(value.birth_date) || null : null,
    gender: value.gender || null,
    email: value.email || null,
    phone_number: value.phone_number || null,
    whatsapp_number: value.whatsapp_number || null,
    zip_code: value.zip_code || null,
    address_street: value.address_street || null,
    address_number: value.address_number || null,
    address_complement: value.address_complement || null,
    address_district: value.address_district || null,
    address_city: value.address_city || null,
    address_state: value.address_state || null,
    tags: value.tags || [],
    customer_since: value.customer_since || null,
    notes: value.notes || null
  };
}

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);

  private clientesSignal = signal<Cliente[]>([]);
  private loadingSignal = signal<boolean>(false);

  readonly clientes = computed(() => this.clientesSignal());
  readonly isLoading = computed(() => this.loadingSignal());

  constructor() {
    effect(() => {
      const companyId = this.tenantService.getCurrentCompanyId();
      if (companyId) {
        this.loadClientes();
      } else {
        this.clientesSignal.set([]);
      }
    });
  }

  async loadClientes() {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return;

    this.loadingSignal.set(true);
    try {
      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('company_id', companyId)
          .order('full_name', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      this.clientesSignal.set(allRows.map(mapRowToCliente));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  getClientes(): Observable<Cliente[]> {
    return from(this.loadClientes().then(() => this.clientesSignal()));
  }

  createCliente(cliente: ClienteFormValue): Observable<Cliente> {
    return from(this.createClienteAsync(cliente));
  }

  private async createClienteAsync(cliente: ClienteFormValue): Promise<Cliente> {
    const user = this.authService.user();
    const profile = this.authService.profile();

    const payload = {
      ...mapClienteToRow(cliente),
      ...this.tenantService.getCompanyPayload(),
      created_by: user?.id,
      author_name: profile?.name || 'Sistema'
    };

    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cliente:', error);
      throw error;
    }

    const newCliente = mapRowToCliente(data);
    this.clientesSignal.update(current => [newCliente, ...current]);
    return newCliente;
  }

  updateCliente(id: string, updates: ClienteFormValue): Observable<Cliente> {
    return from(this.updateClienteAsync(id, updates));
  }

  private async updateClienteAsync(id: string, updates: ClienteFormValue): Promise<Cliente> {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Tentativa de atualizar cliente sem um Company ID ativo.');

    const payload = {
      ...mapClienteToRow(updates),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }

    const updated = mapRowToCliente(data);
    this.clientesSignal.update(current => current.map(c => c.id === id ? updated : c));
    return updated;
  }

  deleteCliente(id: string): Observable<void> {
    return from(this.deleteClienteAsync(id));
  }

  private async deleteClienteAsync(id: string): Promise<void> {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Tentativa de excluir cliente sem um Company ID ativo.');

    const previousState = this.clientesSignal();
    this.clientesSignal.update(current => current.filter(c => c.id !== id));

    try {
      const { error, count } = await supabase
        .from('clients')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
      if (count === 0) throw new Error('Nenhum registro foi excluído pelo banco de dados.');
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      this.clientesSignal.set(previousState);
      throw error;
    }
  }
}
