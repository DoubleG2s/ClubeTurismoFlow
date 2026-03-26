import { Injectable, signal, inject, effect } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { Credit } from '../models/credit';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';

@Injectable({
  providedIn: 'root'
})
export class CreditService {
  private supabase: SupabaseClient;
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);
  
  // State
  credits = signal<Credit[]>([]);
  isLoading = signal<boolean>(true);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    
    // Fetch initial credits reactively when session changes
    effect(() => {
      const session = this.authService.session();
      if (session) {
        this.fetchCredits();
      } else {
        this.credits.set([]);
        this.isLoading.set(false);
      }
    });

    // Real-time subscription could be added here, similar to others, but we'll re-fetch on actions to keep it simpler initially unless real-time is heavily required.
    // Setting up the channel for public.credits:
    this.supabase.channel('public:credits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credits' }, () => {
        this.fetchCredits();
      })
      .subscribe();
  }

  async fetchCredits() {
    this.isLoading.set(true);
    try {
      let query = this.supabase
        .from('credits')
        .select('*')
        .order('expiration_date', { ascending: true }); // Vencimentos mais próximos primeiro
        
      // Preparação futura para RLS/Filtro Multi-Tenant:
      // const companyId = this.tenantService.getCurrentCompanyId();
      // if (companyId) query = query.eq('company_id', companyId);

      const { data, error } = await query;
        
      if (error) {
        console.error('Error fetching credits:', error);
        return;
      }
      
      this.credits.set(data as Credit[]);
    } catch (err) {
      console.error('Unexpected error fetching credits:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async addCredit(creditData: Omit<Credit, 'id' | 'created_at' | 'expiration_date'>) {
    this.isLoading.set(true);
    try {
      const payload = {
        ...creditData,
        ...this.tenantService.getCompanyPayload()
      };

      const { data, error } = await this.supabase
        .from('credits')
        .insert(payload)
        .select()
        .single();
        
      if (error) {
        console.error('Error adding credit:', error);
        return false;
      }
      
      // Update local state immediately for instant feedback
      if (data) {
        this.credits.update(current => {
           const updated = [...current, data as Credit];
           // Mantém ordenado por proximidade de vencimento
           return updated.sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());
        });
      }
      return true;
    } catch (err) {
      console.error('Unexpected error adding credit:', err);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateCredit(id: string, creditData: Partial<Credit>) {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('credits')
        .update(creditData)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('Error updating credit:', error);
        return false;
      }
      
      // Update local state immediately
      if (data) {
        this.credits.update(current => 
          current.map(c => c.id === id ? data as Credit : c)
          // Reordena caso a data tenha sido alterada
          .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime())
        );
      }
      return true;
    } catch (err) {
      console.error('Unexpected error updating credit:', err);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async removeCredit(id: string) {
    this.isLoading.set(true);
    // Optimistic delete for absolute immediate feedback
    this.credits.update(current => current.filter(c => c.id !== id));
    
    try {
      const { error } = await this.supabase
        .from('credits')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting credit:', error);
        // Se errar, forçamos um fetch novamente no real-time ou manualmente para corrigir
        this.fetchCredits();
      }
    } catch (err) {
      console.error('Unexpected error deleting credit:', err);
      this.fetchCredits();
    } finally {
      this.isLoading.set(false);
    }
  }
}
