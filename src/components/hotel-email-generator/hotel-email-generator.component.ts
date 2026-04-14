import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface Guest {
  name: string;
}

interface Apartment {
  name: string;
  locator: string;
  description: string;
  pension: string;
  adults: number;
  children: number;
  guests: Guest[];
}

interface EmailData {
  checkIn: string;
  checkOut: string;
  hotelName: string;
  apartments: Apartment[];
}

@Component({
  selector: 'app-hotel-email-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in relative items-start">
      
      <!-- Right Side: Live Preview (Placed first in flex/grid order for mobile, sticky on desktop) -->
      <div class="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:sticky lg:top-6 order-first lg:order-last flex flex-col gap-5">
        <div class="bg-slate-50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <!-- Preview Header -->
          <div class="bg-white px-5 py-4 border-b border-slate-200 flex justify-between items-center">
            <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Prévia do E-mail
            </h3>
            <button (click)="copyHtml()" 
                    class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                    [ngClass]="copySuccess() ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'">
              @if (copySuccess()) {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Copiado!</span>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>Copiar HTML</span>
              }
            </button>
          </div>
          
          <!-- Web Content Body -->
          <div class="px-0 py-0 flex-1 bg-slate-100 overflow-x-auto min-h-[300px]">
             <div class="bg-white w-full" [innerHTML]="getSafeHtml()"></div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-3">
          <div>
            <button type="button"
                    class="w-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Enviar e-mail
            </button>
            <p class="text-[11px] text-center text-slate-500 mt-2 font-medium">A funcionalidade de envio de e-mail ainda não foi implementada.</p>
          </div>
          
          <button type="button" (click)="resetForm()"
                  class="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Limpar
          </button>
        </div>
      </div>

      <!-- Left Side: Form Controls -->
      <div class="lg:col-span-7 lg:row-start-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative">
        <div class="absolute top-0 left-0 w-full h-1 bg-rose-500 rounded-t-2xl"></div>
        
        <div class="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
          <div class="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
            </svg>
          </div>
          <h3 class="text-base font-bold text-slate-800 tracking-tight">Gerador de Hospedagem</h3>
        </div>

        <form class="space-y-6">
          
          <!-- Dados Globais -->
          <div class="space-y-4">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Informações Gerais</h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5">Data de Ida</label>
                <input type="date" [(ngModel)]="data.checkIn" name="checkIn"
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5">Data de Volta</label>
                <input type="date" [(ngModel)]="data.checkOut" name="checkOut"
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all">
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">Nome do Hotel</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z" />
                  </svg>
                </div>
                <input type="text" [(ngModel)]="data.hotelName" name="hotelName" placeholder="Ex: Salinas Maragogi"
                  class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all">
              </div>
            </div>
          </div>

          <div class="border-t border-slate-100 my-6"></div>

          <!-- Apartamentos -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Quartos / Apartamentos</h4>
              <button type="button" (click)="addApartment()" 
                      class="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Adicionar Quarto
              </button>
            </div>

            <div class="space-y-6">
              @for (apt of data.apartments; track idx; let idx = $index) {
                <div class="p-5 bg-slate-50 border border-slate-200 rounded-xl relative group">
                  
                  <button type="button" (click)="removeApartment(idx)" *ngIf="data.apartments.length > 1"
                          class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 shadow-sm flex items-center justify-center transition-all z-10 opacity-0 group-hover:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Apartamento</label>
                      <input type="text" [(ngModel)]="apt.name" name="apt_name_{{idx}}" placeholder="Ex: APTO 1"
                        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400">
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Localizador (Próprio deste apto)</label>
                      <input type="text" [(ngModel)]="apt.locator" name="apt_loc_{{idx}}" placeholder="Ex: ABCDEF"
                        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400 uppercase font-medium">
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição do Quarto</label>
                      <input type="text" [(ngModel)]="apt.description" name="apt_desc_{{idx}}" placeholder="Ex: Quarto Standard"
                        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400">
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Regime</label>
                      <input type="text" [(ngModel)]="apt.pension" name="apt_pen_{{idx}}" placeholder="Ex: Café da manhã"
                        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400">
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Adultos</label>
                      <input type="number" min="0" [(ngModel)]="apt.adults" name="apt_adt_{{idx}}"
                        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400">
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Crianças</label>
                      <input type="number" min="0" [(ngModel)]="apt.children" name="apt_chd_{{idx}}"
                        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400">
                    </div>
                  </div>

                  <!-- Hóspedes do Apartamento -->
                  <div class="bg-white border border-slate-200 rounded-lg p-3">
                    <div class="flex items-center justify-between mb-3">
                      <label class="text-[10px] font-bold text-slate-400 uppercase">Hóspedes do {{apt.name || 'Apto'}}</label>
                      <button type="button" (click)="addGuest(idx)"
                        class="text-[10px] font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded transition-colors">
                        + Adicionar
                      </button>
                    </div>

                    <div class="space-y-2">
                      @for (guest of apt.guests; track gIdx; let gIdx = $index) {
                        <div class="flex items-center gap-2">
                          <input type="text" [(ngModel)]="guest.name" name="guest_{{idx}}_{{gIdx}}" placeholder="Nome do hóspede"
                            class="flex-1 px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-rose-400">
                          
                          <button type="button" (click)="removeGuest(idx, gIdx)" *ngIf="apt.guests.length > 1"
                                  class="text-slate-400 hover:text-rose-600 p-1">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      }
                    </div>
                  </div>

                </div>
              }
            </div>
          </div>

        </form>
      </div>

    </div>
  `
})
export class HotelEmailGeneratorComponent {
  
  private sanitizer = inject(DomSanitizer);

  data: EmailData = {
    checkIn: '',
    checkOut: '',
    hotelName: '',
    apartments: [this.createNewApartment('APTO 1')]
  };

  copySuccess = signal(false);

  createNewApartment(defaultName: string = ''): Apartment {
    return {
      name: defaultName,
      locator: '',
      description: '',
      pension: '',
      adults: 2,
      children: 0,
      guests: [{ name: '' }]
    };
  }

  addApartment() {
    this.data.apartments.push(this.createNewApartment(`APTO ${this.data.apartments.length + 1}`));
  }

  removeApartment(index: number) {
    if (this.data.apartments.length > 1) {
      this.data.apartments.splice(index, 1);
    }
  }

  addGuest(aptIndex: number) {
    this.data.apartments[aptIndex].guests.push({ name: '' });
  }

  removeGuest(aptIndex: number, guestIndex: number) {
    if (this.data.apartments[aptIndex].guests.length > 1) {
      this.data.apartments[aptIndex].guests.splice(guestIndex, 1);
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return '___/___/___';
    // YYYY-MM-DD to DD/MM/YYYY maintaining local day avoidance issues by splitting
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  }

  getGeneratedText(): string {
    const fIn = this.formatDate(this.data.checkIn);
    const fOut = this.formatDate(this.data.checkOut);
    const hotel = this.data.hotelName || '[Nome do Hotel]';

    let txt = `Olá, tudo bem? 🙂\n\n`;
    txt += `Temos as reservas abaixo que se hospedarão do dia ${fIn} a ${fOut}.\n\n`;
    txt += `Enviamos em anexo uma carta de boas-vindas.\n`;
    txt += `Pedimos, por gentileza, uma atenção especial aos hóspedes abaixo.\n\n`;
    txt += `🏨 ${hotel}\n\n`;

    this.data.apartments.forEach((apt) => {
      const aptName = apt.name || '[Nome do Apto]';
      const loc = apt.locator ? apt.locator.toUpperCase() : '[Localizador]';
      const desc = apt.description || '[Quarto]';
      const pen = apt.pension || '[Regime]';
      
      let pxl = [];
      if (apt.adults > 0) pxl.push(`${apt.adults} ADT`);
      if (apt.children > 0) pxl.push(`${apt.children} CHD`);
      const peoples = pxl.length > 0 ? pxl.join(' / ') : '[Qtd de Pessoas]';

      txt += `🛏️ ${aptName}\n`;
      txt += `Localizador: ${loc}\n`;
      txt += `Descrição: ${desc} + ${pen} – ${peoples}\n\n`;
      
      txt += `Hóspedes:\n`;
      apt.guests.forEach(g => {
        txt += `- ${g.name || '[Hóspede]'}\n`;
      });
      txt += `\n`; 
    });

    return txt.trim();
  }

  getGeneratedHtml(): string {
    const fIn = this.formatDate(this.data.checkIn);
    const fOut = this.formatDate(this.data.checkOut);
    const hotel = this.data.hotelName || '[Nome do Hotel]';

    let html = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; font-family: Arial, sans-serif;">
  <tr>
    <td align="center" style="padding: 30px 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto;">
        <tr>
          <td style="padding: 30px; text-align: center; border-bottom: 3px solid #e11d48; background-color: #ffffff;">
            <img src="/assets/logo-clube-turismo.png" alt="Clube Turismo" style="max-height: 48px; display: block; margin: 0 auto; border: 0; max-width: 100%;">
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px; color: #334155; font-size: 15px; line-height: 1.6;">
            <p style="margin: 0 0 15px 0; font-size: 16px; color: #0f172a;">Olá, tudo bem? 🙂</p>
            <p style="margin: 0 0 15px 0;">Temos as reservas abaixo que se hospedarão do dia <strong>${fIn}</strong> a <strong>${fOut}</strong>.</p>
            <p style="margin: 0 0 25px 0;">Enviamos em anexo uma carta de boas-vindas.<br>
            Pedimos, por gentileza, uma atenção especial aos hóspedes abaixo.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #e11d48; padding: 15px 20px; margin-bottom: 25px; border-radius: 0 6px 6px 0;">
              <h2 style="margin: 0; color: #0f172a; font-size: 18px;">
                <span style="margin-right: 8px;">🏨</span> ${hotel}
              </h2>
            </div>
`;

    this.data.apartments.forEach((apt) => {
      const aptName = apt.name || '[Nome do Apto]';
      const loc = apt.locator ? apt.locator.toUpperCase() : '[Localizador]';
      const desc = apt.description || '[Quarto]';
      const pen = apt.pension || '[Regime]';
      
      let pxl = [];
      if (apt.adults > 0) pxl.push(`${apt.adults} ADT`);
      if (apt.children > 0) pxl.push(`${apt.children} CHD`);
      const peoples = pxl.length > 0 ? pxl.join(' / ') : '[Qtd de Pessoas]';

      html += `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
              <tr>
                <td style="background-color: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0;">
                  <h3 style="margin: 0; color: #334155; font-size: 15px;">
                    <span style="margin-right: 8px;">🛏️</span> <strong>${aptName}</strong>
                  </h3>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
                    <tr>
                      <td width="30%" style="padding-bottom: 8px; color: #64748b;">Localizador:</td>
                      <td width="70%" style="padding-bottom: 8px; font-weight: bold; color: #0f172a;">${loc}</td>
                    </tr>
                    <tr>
                      <td width="30%" style="padding-bottom: 12px; color: #64748b;">Descrição:</td>
                      <td width="70%" style="padding-bottom: 12px; color: #334155;">${desc} + ${pen} &ndash; ${peoples}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-top: 12px; border-top: 1px dashed #e2e8f0;">
                        <div style="color: #64748b; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">Hóspedes 👤</div>
                        <ul style="margin: 0; padding: 0 0 0 20px; color: #334155;">
`;
      
      apt.guests.forEach(g => {
        html += `                         <li style="margin-bottom: 4px;">${g.name || '[Hóspede]'}</li>\n`;
      });

      html += `
                        </ul>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
`;
    });

    html += `
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;

    return html.trim();
  }

  getSafeHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.getGeneratedHtml());
  }

  async copyHtml() {
    const htmlText = this.getGeneratedHtml();
    const plainText = this.getGeneratedText();
    
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const typeHtml = 'text/html';
        const typeText = 'text/plain';
        const blobHtml = new Blob([htmlText], { type: typeHtml });
        const blobText = new Blob([plainText], { type: typeText });
        const data = [new ClipboardItem({
          [typeHtml]: blobHtml,
          [typeText]: blobText
        })];
        await navigator.clipboard.write(data);
      } else {
        await navigator.clipboard.writeText(htmlText);
      }
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy HTML: ', err);
      try {
        await navigator.clipboard.writeText(plainText);
        this.copySuccess.set(true);
        setTimeout(() => this.copySuccess.set(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback failed: ', fallbackErr);
      }
    }
  }

  resetForm() {
    this.data = {
      checkIn: '',
      checkOut: '',
      hotelName: '',
      apartments: [this.createNewApartment('APTO 1')]
    };
  }
}
