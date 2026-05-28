import { Injectable, signal, inject, effect } from '@angular/core';
import { supabase } from './supabase';
import { CommissionCalculation } from '../models/commission-calculation';
import { TenantService } from './tenant.service';

import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CommissionCalculationService {
  private _calculations = signal<CommissionCalculation[]>([]);
  private _isLoading = signal(false);

  readonly calculations = this._calculations.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);

  constructor() {
    effect(() => {
      const companyId = this.tenantService.getCurrentCompanyId();
      if (companyId) {
        this.loadCalculations();
      } else {
        this._calculations.set([]);
      }
    });
  }

  async loadCalculations() {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return;

    this._isLoading.set(true);
    try {
      const { data, error } = await supabase
        .from('commission_calculations')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this._calculations.set((data as CommissionCalculation[]) || []);
    } catch (error) {
      console.error('Error loading commission calculations:', error);
    } finally {
      this._isLoading.set(false);
    }
  }

  async addCalculation(
    calculationData: Omit<CommissionCalculation, 'id' | 'company_id' | 'created_by' | 'created_at' | 'updated_at'>
  ): Promise<boolean> {
    const companyPayload = this.tenantService.getCompanyPayload();
    if (!('company_id' in companyPayload) || !companyPayload.company_id) return false;
    
    const session = this.authService.session();
    const profile = this.authService.profile();
    if (!session) return false;

    this._isLoading.set(true);
    try {
      const fullData = { 
        ...calculationData, 
        ...companyPayload,
        created_by: session.user.id,
        calculation_data: {
          ...calculationData.calculation_data,
          creator_name: profile?.name || 'Sistema'
        }
      };
      const { error } = await supabase
        .from('commission_calculations')
        .insert(fullData);

      if (error) throw error;
      
      await this.loadCalculations();
      return true;
    } catch (error) {
      console.error('Error adding commission calculation:', error);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async updateCalculation(
    id: string,
    calculationData: Partial<Omit<CommissionCalculation, 'id' | 'company_id' | 'created_by' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return false;

    this._isLoading.set(true);
    try {
      const { error } = await supabase
        .from('commission_calculations')
        .update({ ...calculationData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
      
      await this.loadCalculations();
      return true;
    } catch (error) {
      console.error('Error updating commission calculation:', error);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async deleteCalculation(id: string): Promise<boolean> {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return false;

    this._isLoading.set(true);
    try {
      const { error } = await supabase
        .from('commission_calculations')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      this._calculations.update(calcs => calcs.filter(c => c.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting commission calculation:', error);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }
}
