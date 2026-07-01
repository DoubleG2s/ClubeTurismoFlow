import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserProfile } from '../../models/user';
import { supabase } from '../../services/supabase';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-list.component.html'
})
export class UserListComponent implements OnInit {
  private fb: FormBuilder = inject(FormBuilder);
  public authService = inject(AuthService); // Public for HTML access to current user ID

  users = signal<UserProfile[]>([]);
  companies = signal<any[]>([]);
  isLoading = signal(false);
  isCreating = signal(false);
  
  // Filters
  searchQuery = signal('');
  lojaFilter = signal('all');
  roleFilter = signal('all');
  statusFilter = signal('all');

  filteredUsers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const loja = this.lojaFilter();
    const role = this.roleFilter();
    const status = this.statusFilter();

    return this.users().filter(a => {
      const matchQ = q === '' || (a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q));
      const userLoja = a.companies?.name || 'Matriz';
      const matchLoja = loja === 'all' || userLoja === loja;
      const matchRole = role === 'all' || a.role?.toLowerCase() === role;
      const userStatus = (a as any).status || 'active'; // Default active
      const matchStatus = status === 'all' || userStatus === status;
      
      return matchQ && matchLoja && matchRole && matchStatus;
    });
  });

  activeUsersCount = computed(() => this.users().filter(a => ((a as any).status || 'active') === 'active').length);
  pendingUsersCount = computed(() => this.users().filter(a => (a as any).status === 'pending').length);
  inactiveUsersCount = computed(() => this.users().filter(a => (a as any).status === 'inactive').length);

  // Create Form
  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    company_id: ['']
  });

  // Edit State
  editingUser = signal<UserProfile | null>(null);
  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    role: ['agent', Validators.required]
  });

  feedbackMessage = signal<{type: 'success' | 'error', text: string} | null>(null);

  ngOnInit() {
    this.loadUsers();
  }

  async loadUsers() {
    this.isLoading.set(true);
    
    const [usersData, compData] = await Promise.all([
      this.authService.getAllUsers(),
      supabase.from('companies').select('id, name').order('name')
    ]);
    
    this.users.set(usersData);
    if (compData.data) {
      this.companies.set(compData.data);
    }
    
    this.isLoading.set(false);
  }

  // --- Helpers ---
  getInitials(name: string | null | undefined): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getTintFor(name: string | null | undefined): string {
    const colors = ['#EEF2FE', '#FDF2F8', '#F0FDF4', '#FEF3C7', '#F3E8FF', '#FFE4E6'];
    if (!name) return colors[0];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  }

  getTintForDeep(name: string | null | undefined): string {
    const colors = ['#3756C9', '#BE185D', '#15803D', '#B45309', '#6B21A8', '#E11D48'];
    if (!name) return colors[0];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  }

  // --- Create ---
  async onCreateUser() {
    if (this.createForm.invalid) return;

    this.isCreating.set(true);
    this.feedbackMessage.set(null);
    const { email, password, name, company_id } = this.createForm.getRawValue();

    const result = await this.authService.createAgent(email!, password!, name!, company_id || undefined);

    if (result.success) {
      this.feedbackMessage.set({
        type: 'success',
        text: 'Usuário criado! Um e-mail de confirmação foi enviado.'
      });
      this.createForm.reset({ company_id: '' });
      
      // Delay refresh to allow DB update
      setTimeout(() => this.loadUsers(), 1500);
    } else {
      this.feedbackMessage.set({
        type: 'error',
        text: result.error || 'Erro ao criar usuário.'
      });
    }

    this.isCreating.set(false);
  }

  // --- Edit ---
  startEdit(user: UserProfile) {
    this.editingUser.set(user);
    this.editForm.patchValue({
      name: user.name,
      role: user.role
    });
    this.feedbackMessage.set(null);
  }

  cancelEdit() {
    this.editingUser.set(null);
    this.editForm.reset();
  }

  async onUpdateUser() {
    if (this.editForm.invalid || !this.editingUser()) return;
    
    const updates = {
      name: this.editForm.value.name!,
      role: this.editForm.value.role as 'admin' | 'agent'
    };

    const result = await this.authService.updateAgent(this.editingUser()!.id, updates);

    if (result.success) {
      // Optimistic update local list
      this.users.update(list => list.map(u => 
        u.id === this.editingUser()!.id ? { ...u, ...updates } : u
      ));
      this.cancelEdit();
      this.feedbackMessage.set({ type: 'success', text: 'Usuário atualizado com sucesso.' });
    } else {
      alert('Erro ao atualizar: ' + result.error);
    }
  }

  // --- Delete ---
  async onDeleteUser(user: UserProfile) {
    if (user.id === this.authService.user()?.id) {
      alert('Você não pode excluir seu próprio usuário.');
      return;
    }

    const confirmed = confirm(`Tem certeza que deseja excluir o usuário "${user.name}"? Esta ação não pode ser desfeita.`);
    
    if (confirmed) {
      const result = await this.authService.deleteAgent(user.id);
      
      if (result.success) {
        this.users.update(list => list.filter(u => u.id !== user.id));
        this.feedbackMessage.set({ type: 'success', text: 'Usuário removido.' });
      } else {
        alert('Erro ao excluir: ' + result.error);
      }
    }
  }
}