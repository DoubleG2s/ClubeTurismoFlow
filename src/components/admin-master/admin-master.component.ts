import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { Company } from '../../models/company';
import { UserProfile } from '../../models/user';

@Component({
  selector: 'app-admin-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-master.component.html'
})
export class AdminMasterComponent implements OnInit {
  adminService = inject(AdminService);
  
  activeAdminTab = signal<'empresas' | 'usuarios'>('empresas');

  // Computed data
  companies = this.adminService.companies;
  users = this.adminService.users;
  isLoading = this.adminService.isLoading;

  // Company Form Modal States
  showCompanyModal = signal(false);
  editingCompanyId = signal<string | null>(null);
  companyDraft = signal<{ name: string, slug: string }>({ name: '', slug: '' });
  isSaving = signal(false);

  // View Company Modal States
  showViewModal = signal(false);
  viewingCompany = signal<Company | null>(null);

  // Delete Confirm Modal
  showDeleteModal = signal(false);
  companyToDelete = signal<Company | null>(null);
  deleteError = signal<string | null>(null);

  // User Bind Modal
  showBindModal = signal(false);
  selectedUser = signal<UserProfile | null>(null);
  selectedCompanyIdForBind = signal<string>('');

  ngOnInit() {
    this.adminService.loadAdminData();
  }

  // --- Abas ---
  setTab(tab: 'empresas' | 'usuarios') {
    this.activeAdminTab.set(tab);
  }

  // --- Helpers Puros Mapeamento ---
  getUsersCountForCompany(companyId: string): number {
    return this.users().filter(u => u.company_id === companyId).length;
  }

  generateSlugFromName(name: string): string {
    return name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // --- Gestão de Empresas ---
  openCreateCompany() {
    this.editingCompanyId.set(null);
    this.companyDraft.set({ name: '', slug: '' });
    this.showCompanyModal.set(true);
  }

  openEditCompany(company: Company) {
    this.editingCompanyId.set(company.id);
    this.companyDraft.set({ name: company.name, slug: company.slug });
    this.showCompanyModal.set(true);
  }

  closeCompanyModal() {
    this.showCompanyModal.set(false);
  }

  updateSlugAutomatic(name: string) {
    this.companyDraft.update(d => ({ ...d, name, slug: this.generateSlugFromName(name) }));
  }

  async saveCompany() {
    const draft = this.companyDraft();
    if (!draft.name || !draft.slug) return;

    this.isSaving.set(true);
    const isEdit = !!this.editingCompanyId();

    let success = false;
    if (isEdit) {
      success = await this.adminService.updateCompany(this.editingCompanyId()!, draft);
    } else {
      success = await this.adminService.addCompany(draft);
    }

    if (success) {
      this.closeCompanyModal();
    } else {
      alert('Erro ao salvar os dados da empresa. O slug pode já estar em uso.');
    }
    this.isSaving.set(false);
  }

  // --- View Empresa ---
  openViewCompany(company: Company) {
    this.viewingCompany.set(company);
    this.showViewModal.set(true);
  }

  closeViewModal() {
    this.showViewModal.set(false);
    this.viewingCompany.set(null);
  }

  // --- Exclusão Empresa ---
  promptDeleteCompany(company: Company) {
    this.companyToDelete.set(company);
    this.deleteError.set(null);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.companyToDelete.set(null);
  }

  async confirmDeleteCompany() {
    const company = this.companyToDelete();
    if (!company) return;

    this.isSaving.set(true);
    const result = await this.adminService.deleteCompany(company.id);
    
    if (result.success) {
      this.closeDeleteModal();
    } else {
      this.deleteError.set(result.message);
    }
    this.isSaving.set(false);
  }

  // --- Binds (Usuários x Empresas) ---
  openBindModal(user: UserProfile) {
    this.selectedUser.set(user);
    this.selectedCompanyIdForBind.set(user.company_id || '');
    this.showBindModal.set(true);
  }

  closeBindModal() {
    this.showBindModal.set(false);
    this.selectedUser.set(null);
  }

  async saveUserBind() {
    const user = this.selectedUser();
    if (!user) return;

    this.isSaving.set(true);
    const companyId = this.selectedCompanyIdForBind() || null;
    
    const success = await this.adminService.linkUserToCompany(user.id, companyId);
    if (success) {
      this.closeBindModal();
    } else {
      alert('Erro ao vincular empresa ao usuário.');
    }
    this.isSaving.set(false);
  }

  async removeUserBind(user: UserProfile) {
    this.isSaving.set(true);
    const success = await this.adminService.linkUserToCompany(user.id, null);
    if (!success) {
      alert('Erro ao desvincular usuário.');
    }
    this.isSaving.set(false);
  }
}
