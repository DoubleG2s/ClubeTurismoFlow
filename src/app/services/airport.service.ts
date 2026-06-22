import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AirportService {
  private readonly API_URL = 'https://api.api-ninjas.com/v1/airports';

  getAirportByIata(iata: string): Observable<string | null> {
    return from(this.fetchCity(iata)).pipe(
      catchError(() => of(null))
    );
  }

  private async fetchCity(iata: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `${this.API_URL}?iata=${encodeURIComponent(iata.toUpperCase())}`,
        {
          headers: { 'X-Api-Key': environment.apiNinjasKey },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const data = await response.json();
      return (data?.[0]?.city as string) || null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }
}
