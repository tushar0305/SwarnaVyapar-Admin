'use server';

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { isLocalBypassAdminId } from '@/lib/admin-ids';
import { ilikeAny } from '@/lib/postgrest-filter';
import { requireSuperAdmin, logAdminAction, assertAdminPermission } from './admin-auth.service';
import { fanOutShopNotifications, listShopIdsForAudience } from './shop-inbox.service';
import { success, failure } from '@/lib/utils';
import type { ServiceResult } from '@/types';

export interface PlatformAnnouncement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'maintenance';
  target_audience: string;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'maintenance';
  target_audience?: string;
  is_published?: boolean;
  expires_at?: string;
}

export interface UpdateAnnouncementInput {
  title?: string;
  message?: string;
  type?: 'info' | 'warning' | 'critical' | 'maintenance';
  target_audience?: string;
  is_published?: boolean;
  expires_at?: string;
}

async function fanOutAnnouncement(announcement: {
  title: string;
  message: string;
  type: string;
  target_audience?: string | null;
}): Promise<number> {
  const shopIds = await listShopIdsForAudience(announcement.target_audience);
  return fanOutShopNotifications({
    shopIds,
    title: announcement.title,
    message: announcement.message,
    type: announcement.type,
    link: '/notifications',
  });
}

/**
 * Get all announcements with filters
 */
export async function getAllAnnouncements(filters?: {
  published?: boolean;
  type?: string;
  search?: string;
  limit?: number;
}) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  let query = supabase
    .from('platform_announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.published !== undefined) {
    query = query.eq('is_published', filters.published);
  }

  if (filters?.type && filters.type !== 'all') {
    query = query.eq('type', filters.type);
  }

  if (filters?.search) {
    const filter = ilikeAny(['title', 'message'], filters.search);
    if (filter) query = query.or(filter);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as PlatformAnnouncement[];
}

/**
 * Get single announcement by ID
 */
export async function getAnnouncementById(id: string) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('platform_announcements')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as PlatformAnnouncement;
}

/**
 * Create new announcement
 */
export async function createAnnouncement(
  input: CreateAnnouncementInput
): Promise<ServiceResult<PlatformAnnouncement>> {
  try {
    const admin = await assertAdminPermission('system_settings');
    const supabase = getServiceRoleClient();
    const published = input.is_published ?? false;

    const { data, error } = await supabase
      .from('platform_announcements')
      .insert({
        title: input.title.trim(),
        message: input.message.trim(),
        type: input.type,
        target_audience: input.target_audience || 'all',
        is_published: published,
        published_at: published ? new Date().toISOString() : null,
        expires_at: input.expires_at || null,
        created_by: isLocalBypassAdminId(admin.id) ? null : admin.id,
      })
      .select()
      .single();

    if (error) throw error;

    let inboxSent = 0;
    if (published) {
      inboxSent = await fanOutAnnouncement(data);
    }

    await logAdminAction(
      'announcement_created',
      'announcement',
      data.id,
      { title: input.title, type: input.type, is_published: published, inboxSent },
      published
        ? `Announcement published to ${inboxSent} shop inboxes`
        : 'Platform announcement drafted'
    );

    revalidatePath('/announcements');
    return success(data as PlatformAnnouncement);
  } catch (error: any) {
    return failure(error.message || 'Failed to create announcement');
  }
}

/**
 * Update announcement
 */
export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementInput
): Promise<ServiceResult<PlatformAnnouncement>> {
  try {
    await assertAdminPermission('system_settings');
    const supabase = getServiceRoleClient();

    const updateData: Record<string, unknown> = {};
    if (typeof input.title === 'string') updateData.title = input.title.trim();
    if (typeof input.message === 'string') updateData.message = input.message.trim();
    if (input.type === 'info' || input.type === 'warning' || input.type === 'critical' || input.type === 'maintenance') {
      updateData.type = input.type;
    }
    if (typeof input.target_audience === 'string') {
      updateData.target_audience = input.target_audience.trim().slice(0, 40);
    }
    if (typeof input.is_published === 'boolean') updateData.is_published = input.is_published;
    if (typeof input.expires_at === 'string' || input.expires_at === null) {
      updateData.expires_at = input.expires_at;
    }
    if (Object.keys(updateData).length === 0) throw new Error('Nothing to update');

    if (input.is_published) {
      const existing = await getAnnouncementById(id);
      if (!existing.is_published) {
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('platform_announcements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    let inboxSent = 0;
    if (input.is_published && updateData.published_at) {
      inboxSent = await fanOutAnnouncement(data);
    }

    await logAdminAction(
      'announcement_updated',
      'announcement',
      data.id,
      { title: data.title, changes: input, inboxSent },
      inboxSent
        ? `Announcement updated and sent to ${inboxSent} shop inboxes`
        : 'Platform announcement updated'
    );

    revalidatePath('/announcements');
    return success(data as PlatformAnnouncement);
  } catch (error: any) {
    return failure(error.message || 'Failed to update announcement');
  }
}

/**
 * Publish or unpublish announcement
 */
export async function toggleAnnouncementPublish(
  id: string,
  publish: boolean
): Promise<ServiceResult<PlatformAnnouncement>> {
  try {
    await assertAdminPermission('system_settings');
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from('platform_announcements')
      .update({
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    let inboxSent = 0;
    if (publish) {
      inboxSent = await fanOutAnnouncement(data);
    }

    await logAdminAction(
      publish ? 'announcement_published' : 'announcement_unpublished',
      'announcement',
      data.id,
      { title: data.title, inboxSent },
      publish
        ? `Announcement published to ${inboxSent} shop inboxes`
        : 'Announcement unpublished'
    );

    revalidatePath('/announcements');
    return success(data as PlatformAnnouncement);
  } catch (error: any) {
    return failure(error.message || 'Failed to toggle announcement');
  }
}

/**
 * Delete announcement
 */
export async function deleteAnnouncement(id: string): Promise<ServiceResult<void>> {
  try {
    await assertAdminPermission('system_settings');
    const supabase = getServiceRoleClient();

    // Get announcement info for audit
    const announcement = await getAnnouncementById(id);

    const { error } = await supabase
      .from('platform_announcements')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Audit trail
    await logAdminAction(
      'announcement_deleted',
      'announcement',
      id,
      { title: announcement.title, type: announcement.type },
      'Platform announcement deleted'
    );

    revalidatePath('/announcements');
    return success(undefined);
  } catch (error: any) {
    return failure(error.message || 'Failed to delete announcement');
  }
}

/**
 * Get announcement statistics
 */
export async function getAnnouncementStatistics() {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data: announcements } = await supabase
    .from('platform_announcements')
    .select('id, is_published, expires_at, type');

  const items = announcements || [];
  const now = new Date();

  const published = items.filter((a) => a.is_published).length;
  const active = items.filter(
    (a) => a.is_published && (!a.expires_at || new Date(a.expires_at) > now)
  ).length;
  const expired = items.filter(
    (a) => a.expires_at && new Date(a.expires_at) <= now
  ).length;
  const critical = items.filter((a) => a.type === 'critical').length;

  return {
    total: items.length,
    published,
    draft: items.length - published,
    active,
    expired,
    critical,
  };
}
