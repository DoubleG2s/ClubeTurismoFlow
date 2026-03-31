import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Quote } from '../models/quote';
import { supabase } from './supabase';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';

@Injectable({
  providedIn: 'root'
})
export class QuoteService {
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);

  // State
  private quotesSignal = signal<Quote[]>([]);
  private loadingSignal = signal<boolean>(false);

  // Selectors
  readonly quotes = computed(() => this.quotesSignal());
  readonly isLoading = computed(() => this.loadingSignal());

  constructor() {
    effect(() => {
      const companyId = this.tenantService.getCurrentCompanyId();
      if (companyId) {
        this.loadQuotes();
      } else {
        this.quotesSignal.set([]);
      }
    });
  }

  async loadQuotes() {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return;

    this.loadingSignal.set(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Map data to ensure types match, especially JSONB fields
        const mappedData = data.map((q: any) => ({
          ...q,
          hotel_options: q.hotel_options || [],
          flight_details: q.flight_details || {
            outbound: { origin_city: '', destination_city: '', departure_time: '', arrival_time: '' },
            inbound: { origin_city: '', destination_city: '', departure_time: '', arrival_time: '' }
          }
        }));
        this.quotesSignal.set(mappedData as Quote[]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar cotações:', error);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // Returns TRUE if successful, FALSE otherwise
  async addQuote(quote: Omit<Quote, 'id' | 'created_at'>): Promise<boolean> {
    const user = this.authService.user();
    const profile = this.authService.profile();

    try {
      const payload = {
        ...quote,
        ...this.tenantService.getCompanyPayload(),
        created_by: user?.id,
        author_name: profile?.name || 'Sistema'
      };

      const { data, error } = await supabase
        .from('quotes')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Supabase Insert Error:', error);
        throw error;
      }

      if (data) {
        const newQuote = {
          ...data,
          hotel_options: data.hotel_options || [],
          flight_details: data.flight_details || {}
        } as Quote;
        this.quotesSignal.update(current => [newQuote, ...current]);
        alert('Cotação criada com sucesso!');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Erro detalhado ao adicionar cotação:', error);
      if (error.code === '42703') { // Undefined column
        alert('Erro de sistema: O banco de dados precisa ser atualizado com as novas colunas (flight_details, hotel_options).');
      } else {
        alert(`Erro ao salvar cotação: ${error.message || 'Erro desconhecido'}`);
      }
      return false;
    }
  }

  async updateQuote(id: string, updates: Partial<Quote>) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return;

    this.quotesSignal.update(current =>
      current.map(q => q.id === id ? { ...q, ...updates } : q)
    );

    try {
      const { error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar cotação:', error);
      this.loadQuotes(); // Rollback
    }
  }

  async removeQuote(id: string) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return;

    // 1. Snapshot previous state for rollback
    const previousState = this.quotesSignal();

    // 2. Optimistic Update (remove from UI immediately)
    this.quotesSignal.update(current => current.filter(q => q.id !== id));

    try {
      // 3. Database Request with Count check
      const { error, count } = await supabase
        .from('quotes')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      // 4. Verification: If count is 0, it means nothing was deleted (e.g. ID not found or RLS blocked it)
      if (count === 0) {
        throw new Error('Nenhum registro foi excluído pelo banco de dados.');
      }

    } catch (error) {
      console.error('Erro ao remover cotação:', error);
      // 5. Rollback on error
      this.quotesSignal.set(previousState);
      alert('Não foi possível excluir a cotação. Verifique se você tem permissão.');
    }
  }
}