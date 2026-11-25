export interface SuperAdmin {
  id: string;
  user_id: string;
  name: string;
  email: string;
  permissions: AdminPermissions;
  is_active: boolean;
  mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminPermissions {
  manage_shops: boolean;
  manage_users: boolean;
  manage_limits: boolean;
  manage_features: boolean;
  view_analytics: boolean;
  system_settings: boolean;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  changes: Record<string, any>;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  admin?: {
    name: string;
    email: string;
  };
}

export interface Shop {
  id: string;
  shop_name: string;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  is_active: boolean;
  is_suspended?: boolean;
  health_score?: number | string | null;
  last_activity_at?: string | null;
  created_at: string;
  subscriptions?: Subscription[];
}

export interface Subscription {
  id: string;
  shop_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
}

export interface LimitOverride {
  id: string;
  shop_id: string;
  limit_key: string;
  override_value: number;
  reason: string;
  is_temporary: boolean;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  is_enabled_globally: boolean;
  rollout_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface ShopFeatureOverride {
  id: string;
  shop_id: string;
  feature_key: string;
  is_enabled: boolean;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'maintenance';
  target_audience: string;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface SystemHealth {
  database: HealthStatus;
  auth: HealthStatus;
  storage: HealthStatus;
  overall: 'healthy' | 'degraded' | 'down';
  errorRate: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  lastChecked: Date;
  error?: string;
}

export interface PlatformMetrics {
  totalShops: number;
  activeShops: number;
  suspendedShops: number;
  totalUsers: number;
  activeUsers24h: number;
  invoicesToday: number;
  gmv30d: number;
}

export type ServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };
