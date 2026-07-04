import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Timestamp } from '@angular/fire/firestore';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SettingsDataService } from './settings-data.service';
import { MonitorConfig } from '../../core/models/monitor-config.model';
import { environment } from '../../../environments/environment';

const DEFAULTS: Omit<MonitorConfig, 'updated_at'> = {
  check_interval_minutes: 15,
  max_minutes_without_data: 45,
  alert_email: environment.allowedEmail,
  notify_on_down: true,
  notify_on_recovery: true,
};

/**
 * Cross-field validator: max_minutes_without_data must be greater than check_interval_minutes.
 *
 * @param control - The form group to validate.
 * @returns Validation errors or null if valid.
 */
function thresholdValidator(control: AbstractControl): ValidationErrors | null {
  const interval  = control.get('check_interval_minutes')?.value as number | null;
  const threshold = control.get('max_minutes_without_data')?.value as number | null;
  if (interval !== null && threshold !== null && threshold <= interval) {
    return { thresholdTooLow: true };
  }
  return null;
}

/**
 * Formats a Firestore Timestamp to "dd/MM/yyyy HH:mm".
 *
 * @param ts - Timestamp to format.
 */
function formatTimestamp(ts: Timestamp): string {
  const d = ts.toDate();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Settings screen.
 *
 * Loads the current monitor configuration from `monitor_config/current` in Firestore
 * and provides a reactive form to edit and persist check interval, alert threshold,
 * email address, and notification toggles.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NavbarComponent,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <app-navbar />

    <main class="settings-main">
      <h1 class="settings-title">{{ 'SETTINGS.TITLE' | translate }}</h1>

      <form [formGroup]="form" (ngSubmit)="save()">

        <!-- Status Check section -->
        <mat-card class="settings-card">
          <mat-card-header>
            <mat-card-title>{{ 'SETTINGS.SECTION_CHECK' | translate }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'SETTINGS.FIELD_INTERVAL' | translate }}</mat-label>
              <input matInput type="number" formControlName="check_interval_minutes" />
              <mat-hint>{{ 'SETTINGS.FIELD_INTERVAL_HINT' | translate }}</mat-hint>
              @if (form.get('check_interval_minutes')?.invalid && form.get('check_interval_minutes')?.touched) {
                <mat-error>5 – 60</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'SETTINGS.FIELD_THRESHOLD' | translate }}</mat-label>
              <input matInput type="number" formControlName="max_minutes_without_data" />
              @if (form.hasError('thresholdTooLow') && form.get('max_minutes_without_data')?.dirty) {
                <mat-error>{{ 'SETTINGS.THRESHOLD_ERROR' | translate }}</mat-error>
              }
            </mat-form-field>

          </mat-card-content>
        </mat-card>

        <!-- Email Notifications section -->
        <mat-card class="settings-card">
          <mat-card-header>
            <mat-card-title>{{ 'SETTINGS.SECTION_EMAIL' | translate }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'SETTINGS.FIELD_EMAIL' | translate }}</mat-label>
              <input matInput type="email" formControlName="alert_email" />
              @if (form.get('alert_email')?.invalid && form.get('alert_email')?.touched) {
                <mat-error>{{ 'SETTINGS.FIELD_EMAIL' | translate }}</mat-error>
              }
            </mat-form-field>

            <div class="checkbox-group">
              <mat-checkbox formControlName="notify_on_down">
                {{ 'SETTINGS.FIELD_NOTIFY_DOWN' | translate }}
              </mat-checkbox>
              <mat-checkbox formControlName="notify_on_recovery">
                {{ 'SETTINGS.FIELD_NOTIFY_RECOVERY' | translate }}
              </mat-checkbox>
            </div>

          </mat-card-content>
        </mat-card>

        <!-- Actions row -->
        <div class="actions">
          @if (lastUpdated()) {
            <span class="last-updated">
              {{ 'SETTINGS.LAST_UPDATED' | translate }}: {{ lastUpdated() }}
            </span>
          }
          <div class="action-buttons">
            <button
              mat-button
              type="button"
              (click)="cancel()"
              [disabled]="form.pristine || saving()"
            >
              {{ 'SETTINGS.CANCEL' | translate }}
            </button>
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="form.invalid || form.pristine || saving()"
            >
              @if (saving()) {
                <mat-spinner diameter="20" />
              } @else {
                {{ 'SETTINGS.SAVE' | translate }}
              }
            </button>
          </div>
        </div>

      </form>
    </main>
  `,
  styles: [`
    .settings-main {
      max-width: 680px;
      margin: 0 auto;
      padding: 0 1.5rem 3rem;
    }

    .settings-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 1.5rem 0 1rem;
      color: var(--mat-sys-on-surface);
    }

    .settings-card {
      margin-bottom: 1.25rem;
    }

    mat-card-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 1rem !important;
    }

    .full-width {
      width: 100%;
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.25rem 0;
    }

    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      padding-top: 0.5rem;
    }

    .last-updated {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .action-buttons {
      display: flex;
      gap: 0.75rem;
      margin-left: auto;
    }

    button[mat-raised-button] mat-spinner {
      display: inline-block;
    }
  `],
})
export class SettingsComponent implements OnInit {
  private dataService = inject(SettingsDataService);
  private fb          = inject(FormBuilder);
  private snackBar    = inject(MatSnackBar);
  private translate   = inject(TranslateService);
  private destroyRef  = inject(DestroyRef);
  private cdr         = inject(ChangeDetectorRef);

  /** True while the Firestore save operation is in flight. */
  readonly saving = signal(false);

  /** Formatted "dd/MM/yyyy HH:mm" string of last successful save, or null. */
  readonly lastUpdated = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      check_interval_minutes:   [DEFAULTS.check_interval_minutes,   [Validators.required, Validators.min(5), Validators.max(60)]],
      max_minutes_without_data: [DEFAULTS.max_minutes_without_data, [Validators.required, Validators.min(1)]],
      alert_email:              [DEFAULTS.alert_email,              [Validators.required, Validators.email]],
      notify_on_down:           [DEFAULTS.notify_on_down],
      notify_on_recovery:       [DEFAULTS.notify_on_recovery],
    },
    { validators: thresholdValidator },
  );

  private savedValues: Omit<MonitorConfig, 'updated_at'> = { ...DEFAULTS };

  /**
   * Subscribes to `monitor_config/current` and patches the form with the loaded values.
   * Falls back to DEFAULTS when the document does not exist.
   */
  ngOnInit(): void {
    this.dataService.getConfig().pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(config => {
      const values = config ?? DEFAULTS;
      this.savedValues = {
        check_interval_minutes:   values.check_interval_minutes,
        max_minutes_without_data: values.max_minutes_without_data,
        alert_email:              values.alert_email,
        notify_on_down:           values.notify_on_down,
        notify_on_recovery:       values.notify_on_recovery,
      };
      this.form.patchValue(this.savedValues);
      this.form.markAsPristine();
      if (config?.updated_at) {
        this.lastUpdated.set(formatTimestamp(config.updated_at));
      }
      this.cdr.markForCheck();
    });
  }

  /**
   * Persists the current form values to Firestore.
   * Disables the form during the operation and shows a snackbar on success or failure.
   */
  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.form.disable();

    try {
      const raw = this.form.getRawValue();
      const values: Omit<MonitorConfig, 'updated_at'> = {
        check_interval_minutes:   Number(raw.check_interval_minutes),
        max_minutes_without_data: Number(raw.max_minutes_without_data),
        alert_email:              raw.alert_email ?? '',
        notify_on_down:           raw.notify_on_down ?? true,
        notify_on_recovery:       raw.notify_on_recovery ?? true,
      };

      await this.dataService.saveConfig(values);

      this.savedValues = { ...values };
      this.lastUpdated.set(formatTimestamp(Timestamp.fromDate(new Date())));
      this.form.markAsPristine();
      this.snackBar.open(this.translate.instant('SETTINGS.SAVE_SUCCESS'), '', { duration: 3000 });
    } catch {
      this.snackBar.open(this.translate.instant('SETTINGS.SAVE_ERROR'), '', { duration: 4000 });
    } finally {
      this.saving.set(false);
      this.form.enable();
      this.cdr.markForCheck();
    }
  }

  /**
   * Restores the form to the last successfully saved values without a Firestore read.
   */
  cancel(): void {
    this.form.patchValue(this.savedValues);
    this.form.markAsPristine();
    this.cdr.markForCheck();
  }
}
