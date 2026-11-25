import { Megaphone, AlertTriangle, Info, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getAllAnnouncements,
  getAnnouncementStatistics,
} from '@/services/announcement.service';
import { CreateAnnouncement } from './_components/create-announcement';
import { PageHeader } from '../_components/page-header';

const typeIcons = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertTriangle,
  maintenance: Wrench,
};

const typeColors = {
  info: 'text-sky-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
  maintenance: 'text-ink-500',
};

export default async function AnnouncementsPage() {
  const [announcements, stats] = await Promise.all([
    getAllAnnouncements({ limit: 20 }),
    getAnnouncementStatistics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product"
        title="Announcements"
        subtitle="System-wide notices shown inside the shop app."
        actions={<CreateAnnouncement />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Total
            </CardTitle>
            <Megaphone className="w-4 h-4 text-ink-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Published
            </CardTitle>
            <Megaphone className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-emerald-600">{stats.published}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Draft
            </CardTitle>
            <Megaphone className="w-4 h-4 text-ink-400" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-ink-600">{stats.draft}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Critical
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-red-600">{stats.critical}</div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-ink-400 mx-auto mb-4" />
              <p className="text-ink-600 font-medium">No announcements yet</p>
              <p className="text-sm text-ink-500 mt-1">
                Create announcements to communicate with shops
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => {
                const Icon = typeIcons[announcement.type];
                const colorClass = typeColors[announcement.type];
                
                return (
                  <div
                    key={announcement.id}
                    className="p-4 border border-ink-200 rounded-lg hover:bg-ink-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <Icon className={`w-5 h-5 ${colorClass} mt-1`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-ink-900">
                            {announcement.title}
                          </h3>
                          {announcement.is_published ? (
                            <Badge variant="success">Published</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                          <Badge variant="secondary">
                            {announcement.type}
                          </Badge>
                        </div>
                        <p className="text-sm mt-0.5 text-sm text-ink-500">
                          {announcement.message}
                        </p>
                        <p className="text-xs text-ink-500 mt-2">
                          Target: {announcement.target_audience} •{' '}
                          {new Date(announcement.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
