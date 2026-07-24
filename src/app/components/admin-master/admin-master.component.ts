import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { Company } from '../../models/company';
import { UserProfile } from '../../models/user';
import { UserListComponent } from '@components/user-management/user-list.component';
import { MaskDirective } from '../../shared/directives/mask.directive';
import { onlyDigits, maskCpfCnpj, maskCep } from '../../shared/utils/br-masks';
import { isValidCpf, isValidCnpj } from '../../shared/validators/br-validators';

interface CompanyDraft {
  name: string;
  slug: string;
  tax_id: string;
  billing_email: string;
  billing_postal_code: string;
  subscription_expires_at: string;
}

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  trial: 'Teste',
  trialing: 'Teste',
  past_due: 'Pagamento Atrasado',
  canceled: 'Cancelada',
  expired: 'Expirada',
  inactive: 'Inativa'
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
  canceled: 'Cancelado'
};

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  asaas: 'Asaas'
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit_card: 'Cartão de Crédito',
  pix: 'PIX',
  debit_card: 'Cartão de Débito'
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'ct-pill-brand',
  paid: 'ct-pill-brand',
  trial: 'ct-pill-info',
  trialing: 'ct-pill-info',
  past_due: 'ct-pill-warn',
  canceled: 'ct-pill-danger',
  expired: 'ct-pill-danger',
  failed: 'ct-pill-danger',
  pending: 'ct-pill',
  inactive: 'ct-pill'
};

@Component({
  selector: 'app-admin-master',
  standalone: true,
  imports: [CommonModule, FormsModule, UserListComponent, MaskDirective],
  templateUrl: './admin-master.component.html'
})
export class AdminMasterComponent implements OnInit {
  adminService = inject(AdminService);

  activeAdminTab = signal<'usuarios' | 'empresas' | 'vinculos'>('usuarios');

  // Computed data
  companies = this.adminService.companies;
  users = this.adminService.users;
  isLoading = this.adminService.isLoading;

  // Company Form Modal States
  showCompanyModal = signal(false);
  editingCompanyId = signal<string | null>(null);
  editingCompanySnapshot = signal<Company | null>(null);
  companyDraft = signal<CompanyDraft>({
    name: '',
    slug: '',
    tax_id: '',
    billing_email: '',
    billing_postal_code: '',
    subscription_expires_at: ''
  });
  isSaving = signal(false);
  formTouched = signal(false);
  saveError = signal<string | null>(null);

  // Save Confirmation Modal
  showSaveConfirm = signal(false);

  // Success toast
  saveSuccessMessage = signal<string | null>(null);
  private toastTimeoutId?: ReturnType<typeof setTimeout>;

  nameError = computed(() => {
    const name = this.companyDraft().name.trim();
    if (!name) return 'Informe o nome da empresa.';
    if (name.length < 2) return 'O nome deve ter ao menos 2 caracteres.';
    return null;
  });

  taxIdError = computed(() => {
    const digits = onlyDigits(this.companyDraft().tax_id);
    if (!digits) return null;
    if (digits.length === 11) return isValidCpf(digits) ? null : 'CPF inválido.';
    if (digits.length === 14) return isValidCnpj(digits) ? null : 'CNPJ inválido.';
    return 'Documento incompleto.';
  });

  expiresAtError = computed(() => {
    const value = this.companyDraft().subscription_expires_at;
    if (!value) return 'Informe a validade da assinatura.';

    const selected = new Date(`${value}T00:00:00`);
    if (Number.isNaN(selected.getTime())) return 'Data inválida.';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected.getTime() < today.getTime()) return 'A data não pode ser anterior a hoje.';

    const maxDate = new Date(today);
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    if (selected.getTime() > maxDate.getTime()) return 'A data não pode ultrapassar 10 anos a partir de hoje.';

    return null;
  });

  isCompanyFormValid = computed(() => {
    const draft = this.companyDraft();
    if (!draft.name.trim() || draft.name.trim().length < 2) return false;
    if (!draft.slug.trim()) return false;
    if (this.taxIdError()) return false;
    if (this.editingCompanyId() && this.expiresAtError()) return false;
    return true;
  });

  get todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get maxExpiresAtIsoDate(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 10);
    return d.toISOString().slice(0, 10);
  }

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
  setTab(tab: 'usuarios' | 'empresas' | 'vinculos') {
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
    this.editingCompanySnapshot.set(null);
    this.formTouched.set(false);
    this.saveError.set(null);
    this.companyDraft.set({ name: '', slug: '', tax_id: '', billing_email: '', billing_postal_code: '', subscription_expires_at: '' });
    this.showCompanyModal.set(true);
  }

  openEditCompany(company: Company) {
    this.editingCompanyId.set(company.id);
    this.editingCompanySnapshot.set(company);
    this.formTouched.set(false);
    this.saveError.set(null);
    this.companyDraft.set({
      name: company.name,
      slug: company.slug,
      tax_id: maskCpfCnpj(company.tax_id || ''),
      billing_email: company.billing_email || '',
      billing_postal_code: maskCep(company.billing_postal_code || ''),
      subscription_expires_at: company.subscription_expires_at ? company.subscription_expires_at.slice(0, 10) : ''
    });
    this.showCompanyModal.set(true);
  }

  closeCompanyModal() {
    this.showCompanyModal.set(false);
    this.showSaveConfirm.set(false);
    this.saveError.set(null);
    this.formTouched.set(false);
  }

  updateSlugAutomatic(name: string) {
    this.companyDraft.update(d => ({ ...d, name, slug: this.generateSlugFromName(name) }));
  }

  updateCompanyTaxId(taxId: string) {
    this.companyDraft.update(draft => ({ ...draft, tax_id: taxId }));
  }

  updateCompanyBillingPostalCode(billing_postal_code: string) {
    this.companyDraft.update(draft => ({ ...draft, billing_postal_code }));
  }

  updateCompanyBillingEmail(billing_email: string) {
    this.companyDraft.update(draft => ({ ...draft, billing_email }));
  }

  updateSubscriptionExpiresAt(subscription_expires_at: string) {
    this.companyDraft.update(draft => ({ ...draft, subscription_expires_at }));
  }

  requestSaveCompany() {
    this.formTouched.set(true);
    this.saveError.set(null);
    if (!this.isCompanyFormValid()) return;

    if (this.editingCompanyId()) {
      this.showSaveConfirm.set(true);
    } else {
      this.saveCompany();
    }
  }

  async saveCompany() {
    const draft = this.companyDraft();
    this.isSaving.set(true);
    this.saveError.set(null);
    const isEdit = !!this.editingCompanyId();

    let success = false;
    if (isEdit) {
      success = await this.adminService.updateCompany(this.editingCompanyId()!, {
        name: draft.name.trim(),
        slug: draft.slug,
        tax_id: draft.tax_id,
        billing_postal_code: draft.billing_postal_code,
        subscription_expires_at: draft.subscription_expires_at
      });
    } else {
      success = await this.adminService.addCompany({
        name: draft.name.trim(),
        slug: draft.slug,
        tax_id: draft.tax_id,
        billing_email: draft.billing_email,
        billing_postal_code: draft.billing_postal_code
      });
    }

    this.isSaving.set(false);
    this.showSaveConfirm.set(false);

    if (success) {
      const message = isEdit ? 'Empresa atualizada com sucesso.' : 'Empresa criada com sucesso.';
      this.closeCompanyModal();
      this.showSuccessToast(message);
    } else {
      this.saveError.set('Erro ao salvar os dados da empresa. O slug pode já estar em uso.');
    }
  }

  showSuccessToast(message: string) {
    this.saveSuccessMessage.set(message);
    if (this.toastTimeoutId) clearTimeout(this.toastTimeoutId);
    this.toastTimeoutId = setTimeout(() => this.saveSuccessMessage.set(null), 4000);
  }

  formatDateBr(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return '—';
    return `${day}/${month}/${year}`;
  }

  subscriptionStatusLabel(value?: string | null): string {
    return value ? (SUBSCRIPTION_STATUS_LABELS[value] || value) : '—';
  }

  paymentStatusLabel(value?: string | null): string {
    return value ? (PAYMENT_STATUS_LABELS[value] || value) : '—';
  }

  paymentProviderLabel(value?: string | null): string {
    return value ? (PAYMENT_PROVIDER_LABELS[value] || value) : '—';
  }

  paymentMethodLabel(value?: string | null): string {
    return value ? (PAYMENT_METHOD_LABELS[value] || value) : '—';
  }

  statusBadgeClass(value?: string | null): string {
    if (!value) return 'ct-pill';
    return STATUS_BADGE_CLASSES[value] || 'ct-pill';
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
