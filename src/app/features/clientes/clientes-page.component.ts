import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ClienteCardComponent } from '../../components/cliente-card/cliente-card.component';
import { ClienteDrawerComponent } from '../../components/cliente-drawer/cliente-drawer.component';
import { ClienteFormComponent } from '../../components/cliente-form/cliente-form.component';
import { ClienteService } from '../../services/cliente.service';
import { Cliente, ClienteFormValue } from '../../models/cliente';

type ClienteQuickFilter = 'vip' | 'aniversariante' | null;
type ClienteDrawerState = { cliente: Cliente; mode: 'view' | 'edit' } | null;
type ClienteViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'clientes-view-mode';

function isBirthdayToday(birthDate: string | undefined, today = new Date()): boolean {
  if (!birthDate) return false;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(birthDate.trim());
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  return day === today.getDate() && month === today.getMonth() + 1;
}

@Component({
  selector: 'app-clientes-page',
  standalone: true,
  imports: [CommonModule, ClienteCardComponent, ClienteDrawerComponent, ClienteFormComponent],
  templateUrl: './clientes-page.component.html'
})
export class ClientesPageComponent implements OnInit {
  private clienteService = inject(ClienteService);

  clientes = this.clienteService.clientes;
  isLoading = this.clienteService.isLoading;

  formOpen = signal(false);
  isSaving = signal(false);
  viewMode = signal<ClienteViewMode>('grid');

  search = signal('');
  quickFilter = signal<ClienteQuickFilter>(null);

  readonly pageSizeOptions = [50, 100, 300];
  pageSize = signal<number>(50);
  currentPage = signal<number>(0);

  constructor() {
    effect(() => {
      // Sempre que busca, filtro rápido ou tamanho de página mudam, volta pra primeira página
      this.search();
      this.quickFilter();
      this.pageSize();
      this.currentPage.set(0);
    });
  }

  ngOnInit() {
    const saved = localStorage.getItem(VIEW_MODE_KEY) as ClienteViewMode | null;
    if (saved === 'grid' || saved === 'list') {
      this.viewMode.set(saved);
    }
  }

  setViewMode(mode: ClienteViewMode) {
    this.viewMode.set(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  drawer = signal<ClienteDrawerState>(null);
  clienteToDelete = signal<string | null>(null);

  hasActiveFilters = computed(() => !!this.quickFilter() || !!this.search().trim());

  filteredClientes = computed(() => {
    let list = this.clientes();

    if (this.quickFilter() === 'vip') {
      list = list.filter(c => c.tags.includes('VIP'));
    } else if (this.quickFilter() === 'aniversariante') {
      list = list.filter(c => isBirthdayToday(c.birth_date));
    }

    const term = this.search().trim().toLowerCase();
    if (term) {
      list = list.filter(c =>
        c.full_name.toLowerCase().includes(term) ||
        (c.cpf || '').toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term) ||
        (c.address_city || '').toLowerCase().includes(term) ||
        (c.whatsapp_number || '').includes(term)
      );
    }

    return list;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredClientes().length / this.pageSize())));

  paginatedClientes = computed(() => {
    const size = this.pageSize();
    const start = this.currentPage() * size;
    return this.filteredClientes().slice(start, start + size);
  });

  pageRangeStart = computed(() => this.filteredClientes().length === 0 ? 0 : this.currentPage() * this.pageSize() + 1);
  pageRangeEnd = computed(() => Math.min((this.currentPage() + 1) * this.pageSize(), this.filteredClientes().length));

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const items: Array<number | 'ellipsis'> = [];

    if (total <= 7) {
      for (let i = 0; i < total; i++) items.push(i);
      return items;
    }

    items.push(0);
    const lo = Math.max(1, current - 1);
    const hi = Math.min(total - 2, current + 1);
    if (lo > 1) items.push('ellipsis');
    for (let i = lo; i <= hi; i++) items.push(i);
    if (hi < total - 2) items.push('ellipsis');
    items.push(total - 1);

    return items;
  });

  setPageSize(size: number) {
    this.pageSize.set(size);
  }

  goToPage(page: number) {
    this.currentPage.set(Math.min(Math.max(0, page), this.totalPages() - 1));
  }

  prevPage() {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage() + 1);
  }

  totalClientes = computed(() => this.clientes().length);
  vipClientes = computed(() => this.clientes().filter(c => c.tags.includes('VIP')).length);
  aniversariantesHoje = computed(() => this.clientes().filter(c => isBirthdayToday(c.birth_date)).length);
  totalRevenue = computed(() =>
    this.clientes().reduce((sum, c) => sum + (c.trips || []).reduce((s, t) => s + t.amount, 0), 0)
  );

  formatCurrency(value: number): string {
    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  }

  toggleQuickFilter(filter: Exclude<ClienteQuickFilter, null>) {
    this.quickFilter.update(current => current === filter ? null : filter);
  }

  clearFilters() {
    this.search.set('');
    this.quickFilter.set(null);
  }

  toggleNewClienteForm() {
    this.formOpen.update(v => !v);
  }

  onCreateCliente(value: ClienteFormValue) {
    this.isSaving.set(true);
    this.clienteService.createCliente(value).subscribe(() => {
      this.isSaving.set(false);
      this.formOpen.set(false);
    });
  }

  openView(id: string) {
    const cliente = this.clientes().find(c => c.id === id);
    if (cliente) this.drawer.set({ cliente, mode: 'view' });
  }

  openEdit(id: string) {
    const cliente = this.clientes().find(c => c.id === id);
    if (cliente) this.drawer.set({ cliente, mode: 'edit' });
  }

  setDrawerMode(mode: 'view' | 'edit') {
    const current = this.drawer();
    if (current) this.drawer.set({ ...current, mode });
  }

  closeDrawer() {
    this.drawer.set(null);
  }

  onSaveDrawer(value: ClienteFormValue) {
    const current = this.drawer();
    if (!current) return;

    this.isSaving.set(true);
    this.clienteService.updateCliente(current.cliente.id, value).subscribe(updated => {
      this.isSaving.set(false);
      this.drawer.set({ cliente: updated, mode: 'view' });
    });
  }

  promptDelete(id: string) {
    this.clienteToDelete.set(id);
  }

  cancelDelete() {
    this.clienteToDelete.set(null);
  }

  confirmDelete() {
    const id = this.clienteToDelete();
    if (!id) return;

    this.clienteService.deleteCliente(id).subscribe(() => {
      this.clienteToDelete.set(null);
      if (this.drawer()?.cliente.id === id) {
        this.drawer.set(null);
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.clienteToDelete()) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.confirmDelete();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelDelete();
      }
    }
  }
}
