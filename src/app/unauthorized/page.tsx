'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { createClient } from '@/lib/supabase/client';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-security';

export default function UnauthorizedPage() {
  const [loading, setLoading] = useState(false);

  async function backToLogin() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      document.cookie = `${ADMIN_SESSION_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
    } finally {
      // Full navigation so proxy sees cleared session (Link to /login would bounce to /overview)
      window.location.href = '/login';
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex flex-col items-center gap-3">
            <BrandLogo size="lg" />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <CardTitle className="tnum text-xl font-semibold">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            You do not have the required permissions to access the admin control panel.
          </p>
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact your system administrator.
          </p>
          <Button className="w-full" onClick={backToLogin} disabled={loading}>
            {loading ? 'Signing out…' : 'Back to Login'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
