import { Suspense } from 'react';
import { getAllUsers, getUserStatistics } from '@/services/user-management.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/lib/utils';
import { Users, Search, UserX } from 'lucide-react';
import { UserActions } from './_components/user-actions';
import { PageHeader } from '../_components/page-header';
import { PageSkeleton } from '../_components/page-skeleton';

interface UsersPageProps {
  searchParams: Promise<{
    shopId?: string;
    role?: string;
    search?: string;
    page?: string;
  }>;
}

type UsersFilters = Awaited<UsersPageProps['searchParams']>;

async function UserStats() {
  const stats = await getUserStatistics();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-ink-600" />
        </CardHeader>
        <CardContent>
          <div className="tnum text-xl font-semibold">{stats.totalUsers}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          <Users className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="tnum text-xl font-semibold text-emerald-600">{stats.activeUsers}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Disabled Users</CardTitle>
          <UserX className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="tnum text-xl font-semibold text-red-600">{stats.disabledUsers}</div>
        </CardContent>
      </Card>
    </div>
  );
}

async function UsersTable({ searchParams }: { searchParams: UsersFilters }) {
  const page = Number(searchParams.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  const { data: users, count } = await getAllUsers({
    shopId: searchParams.shopId,
    role: searchParams.role,
    search: searchParams.search,
    limit,
    offset,
  });

  const totalPages = count ? Math.ceil(count / limit) : 0;

  if (!users || users.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-ink-400 mb-4" />
            <p className="text-ink-600">No users found</p>
            <p className="text-sm text-ink-500 mt-2">
              Users will appear here as they register
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50 border-b">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    User
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Shop
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Role
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Last sign-in
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ink-50">
                {users.map((userRole) => (
                  <tr key={userRole.id} className="hover:bg-ink-50">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="text-sm font-medium text-ink-900">
                        {userRole.email || 'No email'}
                      </div>
                      <div className="font-mono text-xs text-ink-500">
                        {userRole.user_id.slice(0, 8)}…
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="text-sm text-ink-900">
                        {userRole.shop?.shop_name || 'N/A'}
                      </div>
                      {userRole.shop?.gst_number && (
                        <div className="text-sm text-ink-500">
                          {userRole.shop.gst_number}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge variant={userRole.role === 'owner' ? 'default' : 'secondary'}>
                        {userRole.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge
                        variant={userRole.is_active ? 'success' : 'destructive'}
                      >
                        {userRole.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-ink-500">
                      {userRole.last_sign_in_at
                        ? formatDateTime(userRole.last_sign_in_at)
                        : 'Never'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                      <UserActions
                        userShopRoleId={userRole.id}
                        userId={userRole.user_id}
                        isDisabled={!userRole.is_active}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-600">
            Showing {offset + 1} to {Math.min(offset + limit, count || 0)} of{' '}
            {count} users
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/users?page=${page - 1}${
                  searchParams?.role ? `&role=${searchParams.role}` : ''
                }${searchParams?.search ? `&search=${searchParams.search}` : ''}`}
                className="px-4 py-2 text-sm border rounded-md hover:bg-ink-50"
              >
                Previous
              </a>
            )}
            <span className="px-4 py-2 text-sm border rounded-md bg-ink-50">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={`/users?page=${page + 1}${
                  searchParams?.role ? `&role=${searchParams.role}` : ''
                }${searchParams?.search ? `&search=${searchParams.search}` : ''}`}
                className="px-4 py-2 text-sm border rounded-md hover:bg-ink-50"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Command"
        title="Users"
        subtitle="People with access across every shop on the platform."
      />

      <Suspense fallback={<PageSkeleton hideHeader metrics={3} panels={0} />}>
        <UserStats />
      </Suspense>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter users</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" action="/users" className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <Input
                type="text"
                name="search"
                placeholder="Search email, shop, or user ID"
                defaultValue={params.search}
                className="pl-10"
              />
            </div>
            <select
              name="role"
              defaultValue={params.role || ''}
              className="px-4 py-2 border rounded-md text-sm"
            >
              <option value="">All Roles</option>
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
            <button
              type="submit"
              className="px-6 py-2 bg-ink-900 text-white rounded-md hover:bg-ink-800"
            >
              Apply
            </button>
            {(params.role || params.search) && (
              <a
                href="/users"
                className="px-6 py-2 border rounded-md hover:bg-ink-50"
              >
                Clear
              </a>
            )}
          </form>
        </CardContent>
      </Card>

      <Suspense
        fallback={
          <Card>
            <CardContent>
              <p className="text-center text-ink-600">Loading users...</p>
            </CardContent>
          </Card>
        }
      >
        <UsersTable searchParams={params} />
      </Suspense>
    </div>
  );
}
