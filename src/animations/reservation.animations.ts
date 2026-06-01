import {
  trigger, transition, style, animate, query, stagger, group
} from '@angular/animations';

const EASE_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)';
const SPRING   = 'cubic-bezier(0.34, 1.15, 0.64, 1)';

// Seção "Criar nova reserva" — expansão/colapso
export const expandCollapse = trigger('expandCollapse', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-14px)' }),
    animate(`300ms ${EASE_OUT}`, style({ opacity: 1, transform: 'translateY(0)' }))
  ]),
  transition(':leave', [
    animate(`210ms ${EASE_OUT}`, style({ opacity: 0, transform: 'translateY(-10px)' }))
  ])
]);

// Card do formulário — aparece ao revelar
export const formReveal = trigger('formReveal', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-8px) scale(0.99)' }),
    animate(`380ms ${EASE_OUT}`, style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
  ])
]);

// Alerta de extração de voucher
export const alertSlide = trigger('alertSlide', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-10px)' }),
    animate(`260ms ${EASE_OUT}`, style({ opacity: 1, transform: 'translateY(0)' }))
  ]),
  transition(':leave', [
    animate(`180ms ease-in`, style({ opacity: 0, transform: 'translateY(-6px)' }))
  ])
]);

// Seção de campos dinâmicos (muda com tipo de produto)
export const fieldReveal = trigger('fieldReveal', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(12px)' }),
    animate(`280ms ${EASE_OUT}`, style({ opacity: 1, transform: 'translateY(0)' }))
  ]),
  transition(':leave', [
    animate(`160ms ease-in`, style({ opacity: 0, transform: 'translateY(6px)' }))
  ])
]);

// Passageiro adicionado/removido
export const passengerItem = trigger('passengerItem', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(-14px)' }),
    animate(`230ms ${SPRING}`, style({ opacity: 1, transform: 'translateX(0)' }))
  ]),
  transition(':leave', [
    animate(`160ms ease-in`, style({ opacity: 0, transform: 'translateX(-8px)' }))
  ])
]);

// Grid de cards — entrada escalonada + saída suave
export const listStagger = trigger('listStagger', [
  transition('* => *', [
    group([
      query(':enter', [
        style({ opacity: 0, transform: 'translateY(28px) scale(0.96)' }),
        stagger('65ms', [
          animate(`420ms ${SPRING}`, style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
        ])
      ], { optional: true }),
      query(':leave', [
        animate(`200ms ease-in`, style({ opacity: 0, transform: 'scale(0.94) translateY(-6px)' }))
      ], { optional: true })
    ])
  ])
]);
