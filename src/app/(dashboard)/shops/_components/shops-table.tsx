'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Shop } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { ExternalLink, AlertCircle } from 'lucide-react';

function healthPercent(shop: Shop): number {
  const raw = Number(shop.health_score);
  if (!Number.isFinite(raw)) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

interface ShopsTableProps {
  shops: Shop[];
}

export function ShopsTable({ shops }: ShopsTableProps) {
  const router = useRouter();

  if (shops.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-ink-500">No shops found</p>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="border-b border-ink-100 bg-sand-50/80">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Shop
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Contact
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Status
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Health
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Created
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {shops.map((shop) => (
              <tr key={shop.id} className="hover:bg-ink-50 transition-colors">
                <td className="px-3 py-2.5">
                  <div>
                    <Link
                      href={`/shops/${shop.id}`}
                      className="block max-w-[16rem] truncate font-medium text-ink-900 hover:text-gold-700"
                    >
                      {shop.shop_name}
                    </Link>
                    <p className="text-xs text-ink-500 mt-1">{shop.gst_number || 'No GST'}</p>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-sm">
                    {shop.phone_number && <p className="text-ink-900">{shop.phone_number}</p>}
                    {shop.email && (
                      <p className="text-ink-500 truncate max-w-[200px]">{shop.email}</p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {shop.is_suspended ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Suspended
                    </Badge>
                  ) : shop.is_active === false ? (
                    <Badge variant="secondary" className="gap-1">
                      Inactive
                    </Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-ink-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          healthPercent(shop) > 70
                            ? 'bg-emerald-500'
                            : healthPercent(shop) > 40
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${healthPercent(shop)}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-600">
                      {healthPercent(shop)}%
                    </span>
                  </div>
                </td>
                <td className="tnum whitespace-nowrap px-3 py-2.5 text-sm text-ink-500">
                  {formatDate(shop.created_at)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/shops/${shop.id}/analytics`)}
                  >
                    Health
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
