import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export interface BrasilCity {
  nome: string;
  estado: string;
  id: number;
}

@Injectable({ providedIn: 'root' })
export class BrasilApiService {
  private readonly BASE_URL = 'https://brasilapi.com.br/api';
  private cityCache = new Map<string, BrasilCity[]>();

  searchCities(term: string): Observable<BrasilCity[]> {
    const key = term.trim().toLowerCase();
    if (key.length < 2) return of([]);

    const cached = this.cityCache.get(key);
    if (cached) return of(cached);

    return from(this.fetchCities(term)).pipe(
      tap(cities => {
        if (cities.length > 0) {
          this.cityCache.set(key, cities);
        }
      }),
      catchError(() => of([]))
    );
  }

  private async fetchCities(term: string): Promise<BrasilCity[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `${this.BASE_URL}/cptec/v1/cidade/${encodeURIComponent(term.trim())}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }
}
