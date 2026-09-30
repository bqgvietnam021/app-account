// ============================================================================
// TYPES & INTERFACES CHO SMM ACCOUNT & MEDIA MANAGER
// ============================================================================

interface Staff {
  staff_id: string;
  full_name: string;
  department: string;
  phone: string;
  status: 'ACTIVE' | 'RESIGNED' | string;
  notes?: string;
}

interface EmailAccount {
  email_id: string;
  email_address: string;
  password_enc: string;
  password_plain?: string; // Sử dụng trên giao diện khi hiển thị/sao chép
  recovery_email: string;
  recovery_phone: string;
  two_factor_enc: string;
  two_factor_plain?: string;
  assigned_staff_id: string;
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED' | string;
  notes?: string;
  updated_at?: string;
}

interface SocialChannel {
  channel_id: string;
  email_id: string; // Tham chiếu đến EmailAccount (email_id hoặc parent_email)
  platform: 'TikTok' | 'Facebook' | 'YouTube' | 'Instagram' | 'Threads' | 'X/Twitter' | string;
  channel_name: string;
  channel_url: string;
  login_username: string;
  password_enc: string;
  password_plain?: string;
  assigned_staff_id: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'APPEALING' | string;
  notes?: string;
  updated_at?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface InitialDataPayload {
  staff: Staff[];
  emails: EmailAccount[];
  channels: SocialChannel[];
  isConfigured: boolean;
}

interface SystemConfig {
  spreadsheetId: string;
  masterPassword: string;
  encryptionKey: string;
  isConfigured: boolean;
}
