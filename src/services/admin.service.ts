import { Injectable, signal, computed, inject } from '@angular/core';
import { supabase } from './supabase';
import { Company } from '../models/company';
import { UserProfile } from '../models/user';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private authService = inject(AuthService);

  // States
  private companiesSignal = signal<Company[]>([]);
  private usersSignal = signal<UserProfile[]>([]);
  private loadingSignal = signal<boolean>(false);

  // Selectors
  readonly companies = computed(() => this.companiesSignal());
  readonly users = computed(() => this.usersSignal());
  readonly isLoading = computed(() => this.loadingSignal());

  constructor() {}

  async loadAdminData() {
    if (!this.authService.isAdmin()) return;
    
    this.loadingSignal.set(true);
    try {
      // 1. Fetch Companies
      const { data: companiesData, error: compErr } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      
      if (compErr) throw compErr;
      if (companiesData) this.companiesSignal.set(companiesData as Company[]);

      // 2. Fetch Users with joined Company
      // Supabase join assumes FK `company_id` to `companies(id)` exists
      const { data: usersData, error: usersErr } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .order('name');

      if (usersErr) throw usersErr;
      if (usersData) this.usersSignal.set(usersData as (UserProfile)[]);

    } catch (error) {
      console.error('Erro ao carregar dados do admin:', error);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // --- Companies CRUD ---
  async addCompany(company: Omit<Company, 'id' | 'created_at' | 'updated_at'>) {
    if (!this.authService.isAdmin()) return false;
    this.loadingSignal.set(true);
    
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert(company)
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        this.companiesSignal.update(c => [...c, data as Company]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao adicionar empresa:', error);
      return false;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async updateCompany(id: string, updates: Partial<Company>) {
    if (!this.authService.isAdmin()) return false;
    
    // Optimistic Update
    this.companiesSignal.update(c => c.map(comp => comp.id === id ? { ...comp, ...updates } as Company : comp));

    try {
      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao atualizar empresa:', error);
      this.loadAdminData(); // Rollback
      return false;
    }
  }

  async deleteCompany(id: string) {
    if (!this.authService.isAdmin()) return { success: false, message: 'Acesso negado' };
    
    // Verificar se tem binds
    const usersCount = this.usersSignal().filter(u => u.company_id === id).length;
    if (usersCount > 0) {
      return { success: false, message: 'Existem usuários vinculados a esta empresa. Desvincule-os primeiro.' };
    }

    const previousCompanies = this.companiesSignal();
    this.companiesSignal.update(c => c.filter(comp => comp.id !== id));

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true, message: 'Empresa excluída.' };
    } catch (error) {
      console.error('Erro ao remover empresa:', error);
      this.companiesSignal.set(previousCompanies);
      return { success: false, message: 'Erro ao conectar ao banco de dados.' };
    }
  }

  // --- Users Binds ---
  async linkUserToCompany(userId: string, companyId: string | null) {
    if (!this.authService.isAdmin()) return false;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', userId);

      if (error) throw error;
      
      // Reload everything to get the join correctly
      await this.loadAdminData();
      return true;
    } catch (error) {
      console.error('Erro ao vincular usuário:', error);
      return false;
    }
  }
}
