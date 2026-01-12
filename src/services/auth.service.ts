import { Injectable, signal, computed } from '@angular/core';
import { supabase } from './supabase';
import { User, Session } from '@supabase/supabase-js';
import { UserProfile } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // State
  private sessionSignal = signal<Session | null>(null);
  private userSignal = signal<User | null>(null);
  private profileSignal = signal<UserProfile | null>(null);
  private loadingSignal = signal<boolean>(true);

  // Public Selectors
  readonly session = computed(() => this.sessionSignal());
  readonly user = computed(() => this.userSignal());
  readonly profile = computed(() => this.profileSignal());
  readonly isLoading = computed(() => this.loadingSignal());
  
  readonly isAdmin = computed(() => this.profileSignal()?.role === 'admin');

  constructor() {
    this.init();
  }

  private async init() {
    this.loadingSignal.set(true);
    // 1. Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    await this.handleSession(session);

    // 2. Listen for changes (Login, Logout, Auto-refresh)
    supabase.auth.onAuthStateChange(async (event, session) => {
      // We handle 'SIGNED_IN' manually in signIn() for better UX control,
      // but we listen here for token refreshes or external updates.
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        await this.handleSession(session);
      }
    });
    this.loadingSignal.set(false);
  }

  /**
   * Core logic to sync Supabase session with Local State.
   * FIX: Fetches profile BEFORE updating sessionSignal to prevent UI flashing empty data.
   */
  private async handleSession(session: Session | null) {
    if (!session?.user) {
      // Clear state if no user
      this.profileSignal.set(null);
      this.userSignal.set(null);
      this.sessionSignal.set(null); // This triggers the UI to switch to Login
      return;
    }

    // Optimization: If we already have the profile for this user, don't refetch
    // This helps with TOKEN_REFRESHED events avoiding flickering
    if (this.profileSignal()?.id === session.user.id) {
       this.sessionSignal.set(session);
       return;
    }

    // Fetch Profile synchronously (await) BEFORE confirming session to UI
    const profile = await this.fetchProfileData(session.user.id);

    // Update all signals
    if (profile) {
      this.profileSignal.set(profile);
    }
    this.userSignal.set(session.user);
    
    // CRITICAL: Set session LAST. This triggers the App Component to render the protected layout.
    // By now, profileSignal is already populated, so the Name/Role will render correctly.
    this.sessionSignal.set(session);
  }

  // Helper: Just fetches data, does not set signals
  private async fetchProfileData(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data && !error) {
      return data as UserProfile;
    }
    return null;
  }

  // --- Actions ---

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        return { error: 'E-mail não confirmado. Por favor, verifique sua caixa de entrada.' };
      }
      if (error.message.includes('Invalid login')) {
        return { error: 'Credenciais inválidas.' };
      }
      return { error: error.message };
    }

    // FIX: Manually await handleSession here. 
    // This ensures the LoginComponent waits for the Profile to be loaded 
    // before the promise resolves and the loading spinner stops.
    if (data.session) {
      await this.handleSession(data.session);
    }

    return { error: null };
  }

  async signOut() {
    // Clear local state immediately for instant UI feedback
    this.profileSignal.set(null);
    this.sessionSignal.set(null);
    this.userSignal.set(null);

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  // Admin Action: Create a new user
  async createAgent(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAdmin()) {
      return { success: false, error: 'Acesso negado.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name
        }
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      setTimeout(async () => {
        await supabase
          .from('profiles')
          .update({ name: name })
          .eq('id', data.user!.id);
      }, 1000); 
    }

    return { success: true }; 
  }

  async getAllUsers() {
    if (!this.isAdmin()) return [];
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
      
    return data as UserProfile[] || [];
  }

  async updateAgent(id: string, updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
    if (!this.isAdmin()) return { success: false, error: 'Acesso negado.' };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    
    // Update local profile if admin updated themselves
    if (id === this.user()?.id) {
      const updatedProfile = await this.fetchProfileData(id);
      if (updatedProfile) this.profileSignal.set(updatedProfile);
    }
    
    return { success: true };
  }

  async deleteAgent(id: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAdmin()) return { success: false, error: 'Acesso negado.' };

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }
}