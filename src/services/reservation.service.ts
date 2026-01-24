import { Injectable, signal, computed, inject } from '@angular/core';
import { Reservation } from '../models/reservation';
import { supabase } from './supabase';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private authService = inject(AuthService);

  // State
  private reservationsSignal = signal<Reservation[]>([]);
  private loadingSignal = signal<boolean>(false);

  // Selectors
  readonly reservations = computed(() => this.reservationsSignal());
  readonly isLoading = computed(() => this.loadingSignal());

  constructor() {
    this.loadReservations();
  }

  async loadReservations() {
    this.loadingSignal.set(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Ensure checklist defaults exist if null in DB or structure changed
        const processedData = data.map((item: any) => {
          const rawChecklist = item.checklist || {};

          return {
            ...item,
            passengers: item.passengers || [],
            checklist: {
              contract: rawChecklist.contract || false,
              payment: rawChecklist.payment || false,
              flight_registered: rawChecklist.flight_registered || false,
              hotel_confirmed: rawChecklist.hotel_confirmed || false,

              // Migration Logic for new fields:
              // 1. checkin_outbound (Ida): Inherit from old 'checkin_info' if it exists, otherwise false
              checkin_outbound: rawChecklist.checkin_outbound ?? rawChecklist.checkin_info ?? false,

              // 2. New fields default to false if not present
              checkin_inbound: rawChecklist.checkin_inbound || false,
              hotel_email: rawChecklist.hotel_email || false,
              seats_assigned: rawChecklist.seats_assigned || false,
              seats_assigned_inbound: rawChecklist.seats_assigned_inbound || false,

              // 3. New Pre-sales fields
              contract_signed: rawChecklist.contract_signed || false,
              voucher_sent: rawChecklist.voucher_sent || false
            }
          };
        });
        this.reservationsSignal.set(processedData as Reservation[]);
      }
    } catch (error) {
      console.error('Erro ao carregar reservas:', error);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async addReservation(reservation: Omit<Reservation, 'id' | 'created_at'>) {
    const user = this.authService.user();
    const profile = this.authService.profile();

    try {
      // Prepare payload with explicit new checklist structure
      const payload = {
        ...reservation,
        created_by: user?.id,
        author_name: profile?.name || 'Sistema',
        checklist: {
          contract: false,
          payment: false,
          flight_registered: false,
          hotel_confirmed: false,
          checkin_outbound: false,
          checkin_inbound: false,
          hotel_email: false,
          seats_assigned: false,
          seats_assigned_inbound: false,
          contract_signed: false,
          voucher_sent: false,
          ...reservation.checklist // Overrides if any provided
        }
      };

      const { data, error } = await supabase
        .from('reservations')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Apply defaults for local state consistency
        const newRes = {
          ...data,
          passengers: data.passengers || [],
          checklist: payload.checklist // Use the payload checklist which is guaranteed correct
        };
        this.reservationsSignal.update(current => [newRes as Reservation, ...current]);
      }
    } catch (error) {
      console.error('Erro ao adicionar reserva:', error);
      alert('Erro ao salvar reserva.');
    }
  }

  async updateReservation(id: string, updates: Partial<Reservation>) {
    // Optimistic Update
    this.reservationsSignal.update(current =>
      current.map(r => r.id === id ? { ...r, ...updates } as Reservation : r)
    );

    try {
      const { error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar reserva:', error);
      this.loadReservations(); // Rollback
    }
  }

  async removeReservation(id: string) {
    const previousState = this.reservationsSignal();
    this.reservationsSignal.update(current => current.filter(r => r.id !== id));

    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao remover reserva:', error);
      this.reservationsSignal.set(previousState);
      alert('Não foi possível excluir a reserva.');
    }
  }
}