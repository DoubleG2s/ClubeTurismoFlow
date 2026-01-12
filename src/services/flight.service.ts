import { Injectable, signal, computed, inject } from '@angular/core';
import { Flight } from '../models/flight';
import { supabase } from './supabase';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class FlightService {
  private authService = inject(AuthService);
  
  // State
  private flightsSignal = signal<Flight[]>([]);
  private loadingSignal = signal<boolean>(false);

  // Selectors
  readonly flights = computed(() => this.flightsSignal());
  readonly isLoading = computed(() => this.loadingSignal());

  constructor() {
    // Initial load
    this.loadFlights();
  }

  async loadFlights() {
    this.loadingSignal.set(true);
    try {
      const { data, error } = await supabase
        .from('flights')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        this.flightsSignal.set(data as Flight[]);
      }
    } catch (error) {
      console.error('Erro ao carregar voos:', error);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async addFlight(flight: Omit<Flight, 'id' | 'created_at' | 'confirmed'>) {
    const user = this.authService.user();
    const profile = this.authService.profile();

    try {
      const newFlightPayload = {
        ...flight,
        confirmed: false, // Default
        created_by: user?.id,
        author_name: profile?.name || 'Sistema'
      };

      const { data, error } = await supabase
        .from('flights')
        .insert(newFlightPayload)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        this.flightsSignal.update(current => [data as Flight, ...current]);
      }
    } catch (error) {
      console.error('Erro ao adicionar voo:', error);
      alert('Erro ao salvar no banco de dados. Verifique o console.');
    }
  }

  async updateFlight(id: string, updates: Partial<Omit<Flight, 'id' | 'created_at'>>) {
    // Optimistic Update
    this.flightsSignal.update(current => 
      current.map(f => f.id === id ? { ...f, ...updates } : f)
    );

    try {
      const { error } = await supabase
        .from('flights')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar voo:', error);
      // Rollback on error could be implemented here
      this.loadFlights(); // Revert to server state
    }
  }

  async removeFlight(id: string) {
    // Optimistic UI update
    const previousState = this.flightsSignal();
    this.flightsSignal.update(current => current.filter(f => f.id !== id));

    try {
      const { error } = await supabase
        .from('flights')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao remover voo:', error);
      this.flightsSignal.set(previousState); // Rollback
      alert('Não foi possível excluir o voo.');
    }
  }

  async toggleConfirmation(id: string, isConfirmed: boolean) {
    this.updateFlight(id, { confirmed: isConfirmed });
  }
}