'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { BrandWordmark } from '@/components/brand-logo';
import { createClient } from '@/lib/supabase/client';
import { stampAdminSession } from '@/services/admin-auth.service';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: admin, error: adminError } = await supabase
          .from('super_admins')
          .select('id, is_active')
          .eq('user_id', data.user.id)
          .eq('is_active', true)
          .single();

        if (adminError || !admin) {
          await supabase.auth.signOut();
          toast.error('You do not have super admin access');
          return;
        }

        await stampAdminSession();

        toast.success('Login successful');
        // Full navigation so the idle-session Set-Cookie is on the next request.
        // Soft router.push raced the proxy and bounced back to /login (307).
        window.location.assign('/overview');
        return;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center border-b-0 px-6 pt-8 text-center">
          <BrandWordmark className="mb-4" priority />
          <h1 className="font-serif text-2xl text-ink-900">Founder control</h1>
          <CardDescription>
            Enter your credentials to access the admin control panel
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-ink-600">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@swarnavyapar.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-ink-600">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-ink-500">
            <p>Authorized personnel only</p>
            <p className="mt-1">All actions are logged and monitored</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
