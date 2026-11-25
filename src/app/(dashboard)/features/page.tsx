import { Flag, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getAllFeatureFlags,
  getFeatureFlagsStatistics,
  getAllFeatureOverrides,
} from '@/services/feature-flags.service';
import { CreateFeatureFlag } from './_components/create-feature-flag';
import { FeatureActions } from './_components/feature-actions';
import {
  FeatureOverrideForm,
  RemoveFeatureOverride,
} from './_components/feature-override-form';
import { PageHeader } from '../_components/page-header';

export default async function FeaturesPage() {
  const [flags, stats, overrides] = await Promise.all([
    getAllFeatureFlags(),
    getFeatureFlagsStatistics(),
    getAllFeatureOverrides().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product"
        title="Feature flags"
        subtitle="Control feature rollouts and shop-specific overrides."
        actions={<CreateFeatureFlag />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Total Flags
            </CardTitle>
            <Flag className="w-4 h-4 text-ink-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Enabled Globally
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-emerald-600">
              {stats.enabled_globally}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Disabled Globally
            </CardTitle>
            <TrendingDown className="w-4 h-4 text-ink-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-ink-600">
              {stats.disabled_globally}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Shop Overrides
            </CardTitle>
            <Flag className="w-4 h-4 text-gold-700" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-gold-700">
              {stats.active_overrides}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shop override</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeatureOverrideForm
            flags={flags.map((flag) => ({ feature_key: flag.feature_key, name: flag.name }))}
          />
          {overrides.length === 0 ? (
            <p className="text-sm text-ink-500">No shop overrides yet.</p>
          ) : (
            <ul className="divide-y divide-ink-50">
              {overrides.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      {(Array.isArray(row.shop) ? row.shop[0]?.shop_name : row.shop?.shop_name) ||
                        'Shop'}{' '}
                      · {row.feature_key}
                    </p>
                    <p className="text-xs text-ink-500">
                      {row.is_enabled ? 'On' : 'Off'}
                      {row.reason ? ` · ${row.reason}` : ''}
                    </p>
                  </div>
                  <RemoveFeatureOverride id={row.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Feature Flags Table */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent>
          {flags.length === 0 ? (
            <div className="text-center py-12">
              <Flag className="w-12 h-12 text-ink-400 mx-auto mb-4" />
              <p className="text-ink-600 font-medium">No feature flags found</p>
              <p className="text-sm text-ink-500 mt-1">
                Create your first feature flag to control feature rollouts
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                      Feature
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                      Key
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                      Rollout
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {flags.map((flag) => (
                    <tr key={flag.id} className="hover:bg-ink-50 transition-colors">
                      <td className="px-3 py-2.5">
                        <div>
                          <p className="font-medium text-ink-900">{flag.name}</p>
                          {flag.description && (
                            <p className="text-sm text-ink-500 mt-1">
                              {flag.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <code className="text-xs bg-ink-100 px-2 py-1 rounded">
                          {flag.feature_key}
                        </code>
                      </td>
                      <td className="px-3 py-2.5">
                        {flag.is_enabled_globally ? (
                          <Badge variant="success" className="gap-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <div className="w-2 h-2 rounded-full bg-ink-400" />
                            Disabled
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-ink-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-gold-500"
                              style={{ width: `${flag.rollout_percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-ink-600">
                            {flag.rollout_percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <FeatureActions flag={flag} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
