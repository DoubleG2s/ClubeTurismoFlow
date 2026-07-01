import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '@services/auth.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './settings-page.component.html'
})
export class SettingsPageComponent {
  authService = inject(AuthService);

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
}
