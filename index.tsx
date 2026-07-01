import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  Plane,
  Building2,
  Check,
  Eye,
  EyeOff,
  ImageUp,
  Lock,
  Shield,
  Upload,
  User,
  LUCIDE_ICONS,
  LucideIconProvider
} from 'lucide-angular';
import { AppComponent } from './src/app/layout/app.component';

registerLocaleData(localePt);

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideAnimations(),
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider({ Plane, Building2, Check, Eye, EyeOff, ImageUp, Lock, Shield, Upload, User }) }
  ]
}).catch(err => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.
