import { Injectable, signal, computed, inject } from '@angular/core';
import { Quote } from '../models/quote';
import { supabase } from './supabase';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class QuoteService {
  private authService = inject(AuthService);

  // State
  private quotesSignal = signal<Quote[]>([]);
  private loadingSignal = signal<boolean>(false);

  // Selectors
  readonly quotes = computed(() => this.quotesSignal());
  readonly isLoading = computed(() => this.loadingSignal());

  constructor() {
    this.loadQuotes();
  }

  async loadQuotes() {
    this.loadingSignal.set(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        this.quotesSignal.set(data as Quote[]);
      }
    } catch (error) {
      console.error('Erro ao carregar cotações:', error);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async addQuote(quote: Omit<Quote, 'id' | 'created_at'>) {
    const user = this.authService.user();
    const profile = this.authService.profile();

    try {
      const payload = {
        ...quote,
        created_by: user?.id,
        author_name: profile?.name || 'Sistema'
      };

      const { data, error } = await supabase
        .from('quotes')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        this.quotesSignal.update(current => [data as Quote, ...current]);
      }
    } catch (error) {
      console.error('Erro ao adicionar cotação:', error);
      alert('Erro ao salvar cotação.');
    }
  }

  async updateQuote(id: string, updates: Partial<Quote>) {
    this.quotesSignal.update(current =>
      current.map(q => q.id === id ? { ...q, ...updates } : q)
    );

    try {
      const { error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar cotação:', error);
      this.loadQuotes(); // Rollback
    }
  }

  async removeQuote(id: string) {
    // 1. Snapshot previous state for rollback
    const previousState = this.quotesSignal();

    // 2. Optimistic Update (remove from UI immediately)
    this.quotesSignal.update(current => current.filter(q => q.id !== id));

    try {
      // 3. Database Request with Count check
      const { error, count } = await supabase
        .from('quotes')
        .delete({ count: 'exact' })
        .eq('id', id);

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