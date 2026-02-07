export interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  SITE_URL: string;
  // Physical address for CAN-SPAM compliance
  CANSPAM_ADDRESS: string;
}

export interface Subscriber {
  id: number;
  email: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  confirm_token: string | null;
  unsubscribe_token: string;
  frequency: 'all' | 'monthly' | 'major-only';
  signup_source: string;
  ip_hash: string | null;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  welcome_step: number;
  welcome_next_at: string | null;
}
