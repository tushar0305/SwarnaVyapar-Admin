'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { authActorId } from '@/lib/admin-ids';
import { ilikeAny } from '@/lib/postgrest-filter';
import { requireSuperAdmin, logAdminAction, assertAdminPermission } from './admin-auth.service';
import { success, failure } from '@/lib/utils';
import type { ServiceResult } from '@/types';

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
  created_by: string;
  created_at: string;
  expires_at: string | null;
  shop?: {
    shop_name: string;
    gst_number: string | null;
  };
}

export interface CreateFeatureFlagInput {
  feature_key: string;
  name: string;
  description?: string;
  is_enabled_globally?: boolean;
  rollout_percentage?: number;
}

export interface UpdateFeatureFlagInput {
  name?: string;
  description?: string;
  is_enabled_globally?: boolean;
  rollout_percentage?: number;
}

export interface CreateFeatureOverrideInput {
  shop_id: string;
  feature_key: string;
  is_enabled: boolean;
  reason?: string;
  expires_at?: string;
}

/**
 * Get all feature flags
 */
export async function getAllFeatureFlags(filters?: {
  enabled?: boolean;
  search?: string;
}) {
  await requireSuperAdmin();
  const supabase = await createServerClient();

  let query = supabase
    .from('feature_flags')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.enabled !== undefined) {
    query = query.eq('is_enabled_globally', filters.enabled);
  }

  if (filters?.search) {
    const filter = ilikeAny(['name', 'feature_key', 'description'], filters.search);
    if (filter) query = query.or(filter);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as FeatureFlag[];
}

/**
 * Get single feature flag by key
 */
export async function getFeatureFlagByKey(featureKey: string) {
  await requireSuperAdmin();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('feature_key', featureKey)
    .single();

  if (error) throw error;
  return data as FeatureFlag;
}

/**
 * Create new feature flag
 */
export async function createFeatureFlag(
  input: CreateFeatureFlagInput
): Promise<ServiceResult<FeatureFlag>> {
  try {
    await assertAdminPermission('manage_features');
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        feature_key: input.feature_key,
        name: input.name,
        description: input.description,
        is_enabled_globally: input.is_enabled_globally ?? false,
        rollout_percentage: input.rollout_percentage ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit trail
    await logAdminAction(
      'feature_flag_created',
      'feature_flag',
      data.id,
      { feature_key: input.feature_key, name: input.name },
      'Feature flag created'
    );

    revalidatePath('/features');
    return success(data as FeatureFlag);
  } catch (error: any) {
    return failure(error.message || 'Failed to create feature flag');
  }
}

/**
 * Update feature flag
 */
export async function updateFeatureFlag(
  featureKey: string,
  input: UpdateFeatureFlagInput
): Promise<ServiceResult<FeatureFlag>> {
  try {
    await assertAdminPermission('manage_features');
    const supabase = await createServerClient();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof input.name === 'string') patch.name = input.name.trim();
    if (typeof input.description === 'string') patch.description = input.description;
    if (typeof input.is_enabled_globally === 'boolean') patch.is_enabled_globally = input.is_enabled_globally;
    if (typeof input.rollout_percentage === 'number') {
      if (input.rollout_percentage < 0 || input.rollout_percentage > 100) {
        throw new Error('Rollout percentage must be between 0 and 100');
      }
      patch.rollout_percentage = input.rollout_percentage;
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .update(patch)
      .eq('feature_key', featureKey)
      .select()
      .single();

    if (error) throw error;

    // Audit trail
    await logAdminAction(
      'feature_flag_updated',
      'feature_flag',
      data.id,
      { feature_key: featureKey, changes: input },
      'Feature flag updated'
    );

    revalidatePath('/features');
    return success(data as FeatureFlag);
  } catch (error: any) {
    return failure(error.message || 'Failed to update feature flag');
  }
}

/**
 * Toggle feature flag globally
 */
export async function toggleFeatureFlag(
  featureKey: string,
  enabled: boolean
): Promise<ServiceResult<FeatureFlag>> {
  try {
    await assertAdminPermission('manage_features');
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('feature_flags')
      .update({
        is_enabled_globally: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('feature_key', featureKey)
      .select()
      .single();

    if (error) throw error;

    // Audit trail
    await logAdminAction(
      enabled ? 'feature_flag_enabled' : 'feature_flag_disabled',
      'feature_flag',
      data.id,
      { feature_key: featureKey },
      `Feature flag ${enabled ? 'enabled' : 'disabled'} globally`
    );

    revalidatePath('/features');
    return success(data as FeatureFlag);
  } catch (error: any) {
    return failure(error.message || 'Failed to toggle feature flag');
  }
}

/**
 * Delete feature flag
 */
export async function deleteFeatureFlag(
  featureKey: string
): Promise<ServiceResult<void>> {
  try {
    await assertAdminPermission('manage_features');
    const supabase = await createServerClient();

    // Get flag info for audit
    const flag = await getFeatureFlagByKey(featureKey);

    // Delete all shop overrides first
    await supabase
      .from('shop_feature_overrides')
      .delete()
      .eq('feature_key', featureKey);

    // Delete flag
    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('feature_key', featureKey);

    if (error) throw error;

    // Audit trail
    await logAdminAction(
      'feature_flag_deleted',
      'feature_flag',
      flag.id,
      { feature_key: featureKey, name: flag.name },
      'Feature flag deleted'
    );

    revalidatePath('/features');
    return success(undefined);
  } catch (error: any) {
    return failure(error.message || 'Failed to delete feature flag');
  }
}

/**
 * Get feature overrides for all shops
 */
export async function getAllFeatureOverrides(featureKey?: string) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  let query = supabase
    .from('shop_feature_overrides')
    .select(`
      *,
      shop:shops (
        id,
        shop_name,
        gst_number
      )
    `)
    .order('created_at', { ascending: false });

  if (featureKey) {
    query = query.eq('feature_key', featureKey);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as ShopFeatureOverride[];
}

/**
 * Create shop-specific feature override
 */
export async function createFeatureOverride(
  input: CreateFeatureOverrideInput
): Promise<ServiceResult<ShopFeatureOverride>> {
  try {
    const admin = await assertAdminPermission('manage_features');
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from('shop_feature_overrides')
      .insert({
        shop_id: input.shop_id,
        feature_key: input.feature_key,
        is_enabled: input.is_enabled,
        reason: input.reason,
        expires_at: input.expires_at,
        created_by: authActorId(admin),
      })
      .select()
      .single();

    if (error) throw error;

    // Audit trail
    await logAdminAction(
      'feature_override_created',
      'shop',
      input.shop_id,
      { feature_key: input.feature_key, is_enabled: input.is_enabled },
      'Shop feature override created'
    );

    revalidatePath('/features');
    return success(data as ShopFeatureOverride);
  } catch (error: any) {
    return failure(error.message || 'Failed to create feature override');
  }
}

/**
 * Delete shop feature override
 */
export async function deleteFeatureOverride(
  overrideId: string
): Promise<ServiceResult<void>> {
  try {
    await assertAdminPermission('manage_features');
    const supabase = getServiceRoleClient();

    // Get override info for audit
    const { data: override } = await supabase
      .from('shop_feature_overrides')
      .select('shop_id, feature_key')
      .eq('id', overrideId)
      .single();

    const { error } = await supabase
      .from('shop_feature_overrides')
      .delete()
      .eq('id', overrideId);

    if (error) throw error;

    // Audit trail
    if (override) {
      await logAdminAction(
        'feature_override_deleted',
        'shop',
        override.shop_id,
        { feature_key: override.feature_key },
        'Shop feature override deleted'
      );
    }

    revalidatePath('/features');
    return success(undefined);
  } catch (error: any) {
    return failure(error.message || 'Failed to delete feature override');
  }
}

/**
 * Get statistics for feature flags
 */
export async function getFeatureFlagsStatistics() {
  await requireSuperAdmin();
  const supabase = await createServerClient();

  const [flagsResult, overridesResult] = await Promise.all([
    supabase.from('feature_flags').select('id, is_enabled_globally'),
    supabase.from('shop_feature_overrides').select('id, expires_at'),
  ]);

  const flags = flagsResult.data || [];
  const overrides = overridesResult.data || [];

  const enabledGlobally = flags.filter((f) => f.is_enabled_globally).length;
  const activeOverrides = overrides.filter(
    (o) => !o.expires_at || new Date(o.expires_at) > new Date()
  ).length;

  return {
    total: flags.length,
    enabled_globally: enabledGlobally,
    disabled_globally: flags.length - enabledGlobally,
    active_overrides: activeOverrides,
    expired_overrides: overrides.length - activeOverrides,
  };
}
