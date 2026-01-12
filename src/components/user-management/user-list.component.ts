import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserProfile } from '../../models/user';

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
  isLoading = signal(false);
  isCreating = signal(false);
  
  // Create Form
  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
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
    const data = await this.authService.getAllUsers();
    this.users.set(data);
    this.isLoading.set(false);
  }

  // --- Create ---
  async onCreateUser() {
    if (this.createForm.invalid) return;

    this.isCreating.set(true);
    this.feedbackMessage.set(null);
    const { email, password, name } = this.createForm.getRawValue();

    // Creates user and sends confirmation email via Supabase logic
    const result = await this.authService.createAgent(email!, password!, name!);

    if (result.success) {
      this.feedbackMessage.set({
        type: 'success',
        text: 'Usuário criado! Um e-mail de confirmação foi enviado.'
      });
      this.createForm.reset();
      
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