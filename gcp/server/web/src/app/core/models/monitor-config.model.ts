import { Timestamp } from '@angular/fire/firestore';

/** Firestore document schema for `monitor_config/current`. */
export interface MonitorConfig {
  check_interval_minutes: number;
  max_minutes_without_data: number;
  alert_email: string;
  notify_on_down: boolean;
  notify_on_recovery: boolean;
  updated_at?: Timestamp;
}
