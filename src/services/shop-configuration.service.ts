'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireSuperAdmin, logAdminAction, assertAdminPermission } from './admin-auth.service';

interface ShopConfiguration {
  shopId: string;
  settings: {
    general: {
      shopName: string;
      email: string;
      phone: string;
      timezone: string;
      locale: string;
      currency: string;
    };
    branding: {
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
      customDomain?: string;
    };
    features: {
      [key: string]: boolean;
    };
    limits: {
      maxUsers: number;
      maxProducts: number;
      maxInvoices: number;
      maxCustomers: number;
    };
    notifications: {
      emailEnabled: boolean;
      smsEnabled: boolean;
      pushEnabled: boolean;
    };
  };
}

/**
 * Get shop configuration
 */
export async function getShopConfiguration(shopId: string): Promise<ShopConfiguration> {
  await requireSuperAdmin();
  const supabase = await createServerClient();
  
  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single();
  
  if (!shop) throw new Error('Shop not found');
  
  // Get settings from shop_settings table or use defaults
  const { data: settings } = await supabase
    .from('shop_settings')
    .select('*')
    .eq('shop_id', shopId)
    .single();
  
  return {
    shopId: shop.id,
    settings: {
      general: {
        shopName: shop.shop_name,
        email: shop.email || '',
        phone: shop.phone_number || '',
        timezone: settings?.timezone || 'Asia/Kolkata',
        locale: settings?.locale || 'en-IN',
        currency: settings?.currency || 'INR',
      },
      branding: {
        logo: settings?.logo_url,
        primaryColor: settings?.primary_color || '#6366f1',
        secondaryColor: settings?.secondary_color || '#8b5cf6',
        customDomain: settings?.custom_domain,
      },
      features: settings?.features || {},
      limits: {
        maxUsers: settings?.max_users || 5,
        maxProducts: settings?.max_products || 1000,
        maxInvoices: settings?.max_invoices || 500,
        maxCustomers: settings?.max_customers || 1000,
      },
      notifications: {
        emailEnabled: settings?.email_notifications ?? true,
        smsEnabled: settings?.sms_notifications ?? false,
        pushEnabled: settings?.push_notifications ?? true,
      },
    },
  };
}

/**
 * Update shop configuration
 */
export async function updateShopConfiguration(
  shopId: string,
  updates: Partial<ShopConfiguration['settings']>
) {
  const admin = await assertAdminPermission('manage_shops');
  const supabase = await createServerClient();
  
  // Update shop basic info if changed
  if (updates.general) {
    const shopPatch: Record<string, string> = {};
    if (typeof updates.general.shopName === 'string' && updates.general.shopName.trim()) {
      shopPatch.shop_name = updates.general.shopName.trim();
    }
    if (typeof updates.general.email === 'string') shopPatch.email = updates.general.email.trim();
    if (typeof updates.general.phone === 'string') shopPatch.phone_number = updates.general.phone.trim();
    if (Object.keys(shopPatch).length > 0) {
      await supabase.from('shops').update(shopPatch).eq('id', shopId);
    }
  }
  
  // Update or create settings
  const settingsUpdate: any = {};
  
  if (updates.general) {
    if (typeof updates.general.timezone === 'string') settingsUpdate.timezone = updates.general.timezone;
    if (typeof updates.general.locale === 'string') settingsUpdate.locale = updates.general.locale;
    if (typeof updates.general.currency === 'string') settingsUpdate.currency = updates.general.currency;
  }

  if (updates.branding) {
    if (typeof updates.branding.logo === 'string') settingsUpdate.logo_url = updates.branding.logo;
    if (typeof updates.branding.primaryColor === 'string') settingsUpdate.primary_color = updates.branding.primaryColor;
    if (typeof updates.branding.secondaryColor === 'string') settingsUpdate.secondary_color = updates.branding.secondaryColor;
    if (typeof updates.branding.customDomain === 'string') settingsUpdate.custom_domain = updates.branding.customDomain;
  }
  
  if (updates.features) {
    settingsUpdate.features = updates.features;
  }
  
  if (updates.limits) {
    settingsUpdate.max_users = updates.limits.maxUsers;
    settingsUpdate.max_products = updates.limits.maxProducts;
    settingsUpdate.max_invoices = updates.limits.maxInvoices;
    settingsUpdate.max_customers = updates.limits.maxCustomers;
  }
  
  if (updates.notifications) {
    settingsUpdate.email_notifications = updates.notifications.emailEnabled;
    settingsUpdate.sms_notifications = updates.notifications.smsEnabled;
    settingsUpdate.push_notifications = updates.notifications.pushEnabled;
  }
  
  await supabase
    .from('shop_settings')
    .upsert({
      shop_id: shopId,
      ...settingsUpdate,
      updated_at: new Date().toISOString(),
    });
  
  await logAdminAction(
    'shop_configuration_updated',
    'shop',
    shopId,
    { updates },
    'Updated shop configuration'
  );
}

/**
 * Reset shop configuration to defaults
 */
export async function resetShopConfiguration(shopId: string, reason: string) {
  const admin = await assertAdminPermission('manage_shops');
  const supabase = await createServerClient();
  
  // Delete custom settings (will fall back to defaults)
  await supabase
    .from('shop_settings')
    .delete()
    .eq('shop_id', shopId);
  
  await logAdminAction(
    'shop_configuration_reset',
    'shop',
    shopId,
    { reason },
    `Reset shop configuration to defaults: ${reason}`
  );
}

/**
 * Update shop branding
 */
export async function updateShopBranding(
  shopId: string,
  branding: {
    logo?: string;
    primaryColor: string;
    secondaryColor: string;
    customDomain?: string;
  }
) {
  const admin = await assertAdminPermission('manage_shops');
  const supabase = await createServerClient();
  
  await supabase
    .from('shop_settings')
    .upsert({
      shop_id: shopId,
      logo_url: branding.logo,
      primary_color: branding.primaryColor,
      secondary_color: branding.secondaryColor,
      custom_domain: branding.customDomain,
      updated_at: new Date().toISOString(),
    });
  
  await logAdminAction(
    'shop_branding_updated',
    'shop',
    shopId,
    { branding },
    'Updated shop branding settings'
  );
}

/**
 * Update shop timezone and localization
 */
export async function updateShopLocalization(
  shopId: string,
  localization: {
    timezone: string;
    locale: string;
    currency: string;
    dateFormat?: string;
    timeFormat?: string;
  }
) {
  const admin = await assertAdminPermission('manage_shops');
  const supabase = await createServerClient();
  
  await supabase
    .from('shop_settings')
    .upsert({
      shop_id: shopId,
      timezone: localization.timezone,
      locale: localization.locale,
      currency: localization.currency,
      date_format: localization.dateFormat,
      time_format: localization.timeFormat,
      updated_at: new Date().toISOString(),
    });
  
  await logAdminAction(
    'shop_localization_updated',
    'shop',
    shopId,
    { localization },
    'Updated shop localization settings'
  );
}

/**
 * Update feature access for shop
 */
export async function updateShopFeatureAccess(
  shopId: string,
  features: { [key: string]: boolean }
) {
  const admin = await assertAdminPermission('manage_shops');
  const supabase = await createServerClient();
  
  // Get current settings
  const { data: currentSettings } = await supabase
    .from('shop_settings')
    .select('features')
    .eq('shop_id', shopId)
    .single();
  
  const updatedFeatures = {
    ...(currentSettings?.features || {}),
    ...features,
  };
  
  await supabase
    .from('shop_settings')
    .upsert({
      shop_id: shopId,
      features: updatedFeatures,
      updated_at: new Date().toISOString(),
    });
  
  await logAdminAction(
    'shop_feature_access_updated',
    'shop',
    shopId,
    { features },
    'Updated shop feature access'
  );
}

/**
 * Update shop limits
 */
export async function updateShopLimits(
  shopId: string,
  limits: {
    maxUsers?: number;
    maxProducts?: number;
    maxInvoices?: number;
    maxCustomers?: number;
  }
) {
  const admin = await assertAdminPermission('manage_shops');
  const supabase = await createServerClient();
  
  await supabase
    .from('shop_settings')
    .upsert({
      shop_id: shopId,
      max_users: limits.maxUsers,
      max_products: limits.maxProducts,
      max_invoices: limits.maxInvoices,
      max_customers: limits.maxCustomers,
      updated_at: new Date().toISOString(),
    });
  
  await logAdminAction(
    'shop_limits_updated',
    'shop',
    shopId,
    { limits },
    'Updated shop resource limits'
  );
}

/**
 * Get all shops configurations (summary)
 */
export async function getAllShopsConfigurations() {
  await requireSuperAdmin();
  const supabase = await createServerClient();
  
  const { data: shops } = await supabase
    .from('shops')
    .select(`
      id,
      shop_name,
      email,
      is_active,
      shop_settings (
        timezone,
        locale,
        currency,
        max_users,
        max_products
      )
    `)
    .order('created_at', { ascending: false });
  
  return shops || [];
}

/**
 * Bulk update shop settings
 */
export async function bulkUpdateShopSettings(
  shopIds: string[],
  settings: {
    timezone?: string;
    locale?: string;
    feature?: { key: string; enabled: boolean };
  }
) {
  const admin = await assertAdminPermission('manage_shops');
  const supabase = await createServerClient();
  
  for (const shopId of shopIds) {
    const updates: any = {};
    
    if (settings.timezone) updates.timezone = settings.timezone;
    if (settings.locale) updates.locale = settings.locale;
    
    if (settings.feature) {
      const { data: current } = await supabase
        .from('shop_settings')
        .select('features')
        .eq('shop_id', shopId)
        .single();
      
      updates.features = {
        ...(current?.features || {}),
        [settings.feature.key]: settings.feature.enabled,
      };
    }
    
    await supabase
      .from('shop_settings')
      .upsert({
        shop_id: shopId,
        ...updates,
        updated_at: new Date().toISOString(),
      });
  }
  
  await logAdminAction(
    'bulk_shop_settings_updated',
    'shop',
    'bulk',
    { shopIds, settings },
    `Bulk updated settings for ${shopIds.length} shops`
  );
}
