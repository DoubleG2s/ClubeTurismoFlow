import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { VendaCardComponent } from '../../components/venda-card/venda-card.component';
import { VendaDrawerComponent } from '../../components/venda-drawer/venda-drawer.component';
import { VendaWizardComponent } from '../../components/venda-wizard/venda-wizard.component';
import { VendaService } from '../../services/venda.service';
import { STATUS_VENDA, Venda, VendaFormValue, VendaStatus, brl, calcReceitaPrevista, calcValorTotal } from '../../models/venda';

type VendaDrawerState = { venda: Venda; mode: 'view' | 'edit' } | null;
type VendaViewMode = 'grid' | 'list';
type VendaTab = 'vendas' | 'nova';

const VIEW_MODE_KEY = 'vendas-view-mode';

@Component({
  selector: 'app-vendas-page',
  standalone: true,
  imports: [CommonModule, VendaCardComponent, VendaDrawerComponent, VendaWizardComponent],
  templateUrl: './vendas-page.component.html'
})
export class VendasPageComponent {
  private vendaService = inject(VendaService);

  vendas = this.vendaService.vendas;

  readonly statusOptions = STATUS_VENDA;

  tab = signal<VendaTab>('vendas');
  viewMode = signal<VendaViewMode>('grid');
  isSaving = signal(false);

  search = signal('');
  statusFilter = signal<VendaStatus | null>(null);

  readonly pageSize = 12;
  currentPage = signal(0);

  drawer = signal<VendaDrawerState>(null);
  vendaToDelete = signal<number | null>(null);

  toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.search();
      this.statusFilter();
      this.currentPage.set(0);
    });
  }

  ngOnInit() {
    const saved = localStorage.getItem(VIEW_MODE_KEY) as VendaViewMode | null;
    if (saved === 'grid' || saved === 'list') this.viewMode.set(saved);
  }

  setViewMode(mode: VendaViewMode) {
    this.viewMode.set(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  hasActiveFilters = computed(() => !!this.statusFilter() || !!this.search().trim());

  filteredVendas = computed(() => {
    let list = this.vendas();

    if (this.statusFilter()) {
      list = list.filter(v => v.status === this.statusFilter());
    }

    const term = this.search().trim().toLowerCase();
    if (term) {
      list = list.filter(v =>
        String(v.numero).includes(term) ||
        (v.numeroReserva || '').toLowerCase().includes(term) ||
        (v.pagante ? v.pagante.nome.toLowerCase() : '').includes(term) ||
        v.produto.destino.toLowerCase().includes(term) ||
        v.vendedor.toLowerCase().includes(term)
      );
    }

    return [...list].sort((a, b) => b.numero - a.numero);
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredVendas().length / this.pageSize)));

  paginatedVendas = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filteredVendas().slice(start, start + this.pageSize);
  });

  pageRangeStart = computed(() => this.filteredVendas().length === 0 ? 0 : this.currentPage() * this.pageSize + 1);
  pageRangeEnd = computed(() => Math.min((this.currentPage() + 1) * this.pageSize, this.filteredVendas().length));

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

  stats = computed(() => {
    const list = this.filteredVendas();
    const abertas = list.filter(v => v.status === 'Aberta' || v.status === 'Confirmada').length;
    const receitaTotal = list.reduce((s, v) => s + calcReceitaPrevista(v.comissao, v.valores), 0);
    const valorTotalSoma = list.reduce((s, v) => s + calcValorTotal(v.valores), 0);
    const ticket = list.length ? valorTotalSoma / list.length : 0;
    return { total: list.length, abertas, receitaTotal, ticket };
  });

  formatCurrency(value: number): string {
    return brl(value);
  }

  toggleStatusFilter(status: VendaStatus) {
    this.statusFilter.update(current => current === status ? null : status);
  }

  clearFilters() {
    this.search.set('');
    this.statusFilter.set(null);
    this.currentPage.set(0);
  }

  onSearchChange(value: string) {
    this.search.set(value);
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

  setTab(tab: VendaTab) {
    this.tab.set(tab);
  }

  private flashToast(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2600);
  }

  onWizardDone(value: VendaFormValue) {
    const created = this.vendaService.createVenda(value);
    this.tab.set('vendas');
    this.flashToast(`Venda #${created.numero} registrada — reserva ${created.numeroReserva}`);
  }

  openView(id: number) {
    const venda = this.vendas().find(v => v.id === id);
    if (venda) this.drawer.set({ venda, mode: 'view' });
  }

  openEdit(id: number) {
    const venda = this.vendas().find(v => v.id === id);
    if (venda) this.drawer.set({ venda, mode: 'edit' });
  }

  setDrawerMode(mode: 'view' | 'edit') {
    const current = this.drawer();
    if (current) this.drawer.set({ ...current, mode });
  }

  closeDrawer() {
    this.drawer.set(null);
  }

  onSaveDrawer(value: VendaFormValue) {
    const current = this.drawer();
    if (!current) return;
    this.isSaving.set(true);
    const updated = this.vendaService.updateVenda(current.venda.id, value);
    this.isSaving.set(false);
    this.drawer.set({ venda: updated, mode: 'view' });
    this.flashToast('Venda atualizada');
  }

  promptDelete(id: number) {
    this.vendaToDelete.set(id);
  }

  cancelDelete() {
    this.vendaToDelete.set(null);
  }

  confirmDelete() {
    const id = this.vendaToDelete();
    if (!id) return;
    this.vendaService.deleteVenda(id);
    this.vendaToDelete.set(null);
    if (this.drawer()?.venda.id === id) this.drawer.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.vendaToDelete()) {
      if (event.key === 'Enter') { event.preventDefault(); this.confirmDelete(); }
      else if (event.key === 'Escape') { event.preventDefault(); this.cancelDelete(); }
    }
  }
}
