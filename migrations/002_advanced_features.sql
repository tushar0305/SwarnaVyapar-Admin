-- Migration: Advanced Admin Features
-- Created: 2026-06-24
-- Description: Tables for communications, onboarding, billing, and shop configuration

-- =======================
-- Communications System
-- =======================

-- Admin communications (emails, broadcasts)
CREATE TABLE IF NOT EXISTS public.admin_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.super_admins(id),
  type TEXT NOT NULL CHECK (type IN ('email', 'notification', 'sms', 'broadcast')),
  recipients UUID[] NOT NULL, -- Array of shop IDs
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_communications_admin_id ON public.admin_communications(admin_id);
CREATE INDEX idx_admin_communications_type ON public.admin_communications(type);
CREATE INDEX idx_admin_communications_sent_at ON public.admin_communications(sent_at);

-- Shop notifications (in-app)
CREATE TABLE IF NOT EXISTS public.shop_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')),
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.super_admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_shop_notifications_shop_id ON public.shop_notifications(shop_id);
CREATE INDEX idx_shop_notifications_is_read ON public.shop_notifications(is_read);
CREATE INDEX idx_shop_notifications_created_at ON public.shop_notifications(created_at);

-- Support tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category TEXT,
  created_by UUID REFERENCES public.super_admins(id),
  assigned_to UUID REFERENCES public.super_admins(id),
  resolved_by UUID REFERENCES public.super_admins(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_support_tickets_shop_id ON public.support_tickets(shop_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);

-- =======================
-- Onboarding System
-- =======================

-- Onboarding progress tracking
CREATE TABLE IF NOT EXISTS public.shop_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.super_admins(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, step_id)
);

CREATE INDEX idx_shop_onboarding_progress_shop_id ON public.shop_onboarding_progress(shop_id);
CREATE INDEX idx_shop_onboarding_progress_is_completed ON public.shop_onboarding_progress(is_completed);

-- Onboarding assistance tracking
CREATE TABLE IF NOT EXISTS public.onboarding_assistance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  assistance_type TEXT NOT NULL CHECK (assistance_type IN ('email', 'call', 'tutorial', 'chat')),
  provided_by UUID NOT NULL REFERENCES public.super_admins(id),
  provided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_onboarding_assistance_shop_id ON public.onboarding_assistance(shop_id);
CREATE INDEX idx_onboarding_assistance_provided_at ON public.onboarding_assistance(provided_at);

-- =======================
-- Billing System
-- =======================

-- Payment records
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT NOT NULL,
  transaction_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_payments_shop_id ON public.payments(shop_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_created_at ON public.payments(created_at);

-- Refund records
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  processed_by UUID NOT NULL REFERENCES public.super_admins(id),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX idx_refunds_shop_id ON public.refunds(shop_id);
CREATE INDEX idx_refunds_status ON public.refunds(status);

-- Payment methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('card', 'bank', 'upi', 'wallet')),
  last_four TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_shop_id ON public.payment_methods(shop_id);
CREATE INDEX idx_payment_methods_is_default ON public.payment_methods(is_default);

-- Billing invoices
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  generated_by UUID NOT NULL REFERENCES public.super_admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_billing_invoices_shop_id ON public.billing_invoices(shop_id);
CREATE INDEX idx_billing_invoices_status ON public.billing_invoices(status);
CREATE INDEX idx_billing_invoices_due_date ON public.billing_invoices(due_date);

-- =======================
-- Shop Configuration
-- =======================

-- Shop settings and configuration
CREATE TABLE IF NOT EXISTS public.shop_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  
  -- General settings
  timezone TEXT DEFAULT 'Asia/Kolkata',
  locale TEXT DEFAULT 'en-IN',
  currency TEXT DEFAULT 'INR',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  time_format TEXT DEFAULT '24h',
  
  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  custom_domain TEXT,
  
  -- Features (JSONB for flexible feature flags)
  features JSONB DEFAULT '{}',
  
  -- Limits
  max_users INTEGER DEFAULT 5,
  max_products INTEGER DEFAULT 1000,
  max_invoices INTEGER DEFAULT 500,
  max_customers INTEGER DEFAULT 1000,
  
  -- Notifications
  email_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT FALSE,
  push_notifications BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shop_settings_shop_id ON public.shop_settings(shop_id);

-- =======================
-- RLS Policies (Optional - adjust based on your needs)
-- =======================

-- Enable RLS on new tables
ALTER TABLE public.admin_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_assistance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

-- Super admin can access everything
CREATE POLICY "Super admins can access all communications"
  ON public.admin_communications FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

CREATE POLICY "Super admins can access all shop notifications"
  ON public.shop_notifications FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

CREATE POLICY "Super admins can access all support tickets"
  ON public.support_tickets FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

CREATE POLICY "Super admins can access all onboarding progress"
  ON public.shop_onboarding_progress FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

CREATE POLICY "Super admins can access all onboarding assistance"
  ON public.onboarding_assistance FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

CREATE POLICY "Super admins can access all payments"
  ON public.payments FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

CREATE POLICY "Super admins can access all refunds"
  ON public.refunds FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

CREATE POLICY "Super admins can access all payment methods"
  ON public.payment_methods FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

CREATE POLICY "Super admins can access all billing invoices"
  ON public.billing_invoices FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

CREATE POLICY "Super admins can access all shop settings"
  ON public.shop_settings FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- Grant permissions
GRANT ALL ON public.admin_communications TO authenticated;
GRANT ALL ON public.shop_notifications TO authenticated;
GRANT ALL ON public.support_tickets TO authenticated;
GRANT ALL ON public.shop_onboarding_progress TO authenticated;
GRANT ALL ON public.onboarding_assistance TO authenticated;
GRANT ALL ON public.payments TO authenticated;
GRANT ALL ON public.refunds TO authenticated;
GRANT ALL ON public.payment_methods TO authenticated;
GRANT ALL ON public.billing_invoices TO authenticated;
GRANT ALL ON public.shop_settings TO authenticated;
