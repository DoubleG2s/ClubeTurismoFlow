import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-confirm-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './confirm-modal.component.html',
})
export class ConfirmModalComponent {
    @Input() title: string = 'Confirmar Ação';
    @Input() message: string = 'Tem certeza que deseja prosseguir?';
    @Input() confirmText: string = 'Confirmar';
    @Input() cancelText: string = 'Cancelar';

    @Output() confirm = new EventEmitter<void>();
    @Output() cancel = new EventEmitter<void>();
}
