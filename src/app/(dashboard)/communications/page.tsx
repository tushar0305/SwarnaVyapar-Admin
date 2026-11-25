import { MessageSquare, Bell, Users, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAllSupportTickets } from '@/services/communication.service';
import { getOnboardingStatistics } from '@/services/onboarding.service';
import { BroadcastMessageDialog } from './_components/broadcast-message';
import { CreateTicketDialog } from './_components/create-ticket';
import { TicketStatusControl } from './_components/ticket-status-control';
import { PageHeader } from '../_components/page-header';
import Link from 'next/link';

const priorityColors = {
  low: 'bg-ink-100 text-ink-700',
  medium: 'bg-sky-100 text-sky-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const statusColors = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-sky-100 text-sky-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-ink-100 text-ink-700',
};

export default async function CommunicationsPage() {
  let tickets: Awaited<ReturnType<typeof getAllSupportTickets>> = [];
  let onboardingStats = {
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    needsHelp: 0,
    avgProgress: 0,
  };
  try {
    tickets = await getAllSupportTickets();
  } catch {
    tickets = [];
  }
  try {
    onboardingStats = await getOnboardingStatistics();
  } catch {
    /* optional advanced tables */
  }

  const openTickets = tickets.filter((t: { status?: string }) => t.status === 'open').length;
  const urgentTickets = tickets.filter((t: { priority?: string }) => t.priority === 'urgent').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product"
        title="Communications"
        subtitle="Shop outreach, onboarding help, and support tickets."
        actions={
          <>
            <CreateTicketDialog />
            <BroadcastMessageDialog />
          </>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Open Tickets
            </CardTitle>
            <MessageSquare className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-orange-600">{openTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Urgent Issues
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-red-600">{urgentTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Onboarding Progress
            </CardTitle>
            <Users className="w-4 h-4 text-gold-700" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-gold-700">
              {Math.round(onboardingStats.avgProgress)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Need Help
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-amber-600">
              {onboardingStats.needsHelp}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gold-700" />
              Activation overview
            </span>
            <Link href="/activation" className="text-sm font-normal text-gold-700 hover:underline">
              Open list →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <p className="tnum text-xl font-semibold text-emerald-600">
                {onboardingStats.completed}
              </p>
              <p className="text-sm mt-0.5 text-sm text-ink-500">Activated</p>
            </div>
            <div className="text-center p-4 bg-sky-50 rounded-lg">
              <p className="tnum text-xl font-semibold text-sky-600">
                {onboardingStats.inProgress}
              </p>
              <p className="text-sm mt-0.5 text-sm text-ink-500">In Progress</p>
            </div>
            <div className="text-center p-4 bg-ink-50 rounded-lg">
              <p className="tnum text-xl font-semibold text-ink-600">
                {onboardingStats.notStarted}
              </p>
              <p className="text-sm mt-0.5 text-sm text-ink-500">Not Started</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <p className="tnum text-xl font-semibold text-amber-600">
                {onboardingStats.needsHelp}
              </p>
              <p className="text-sm mt-0.5 text-sm text-ink-500">Needs Assistance</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button className="h-10 w-full gap-2" variant="outline" asChild>
          <Link href="/whatsapp">
            <MessageSquare className="h-4 w-4" />
            WhatsApp shops
          </Link>
        </Button>
        <Button className="h-10 w-full gap-2" variant="outline" asChild>
          <Link href="/announcements">
            <Bell className="h-4 w-4" />
            Announcements
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent support tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-ink-400 mx-auto mb-4" />
              <p className="text-ink-600">No support tickets yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.slice(0, 20).map((ticket: any) => (
                <div
                  key={ticket.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between p-4 border border-ink-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-ink-900">{ticket.subject}</h3>
                      <Badge className={priorityColors[ticket.priority as keyof typeof priorityColors]}>
                        {ticket.priority}
                      </Badge>
                      <Badge className={statusColors[ticket.status as keyof typeof statusColors]}>
                        {ticket.status}
                      </Badge>
                    </div>
                    <p className="text-sm mt-0.5 text-sm text-ink-500">
                      {ticket.shop?.shop_name || 'Unknown Shop'}
                    </p>
                    <p className="text-sm text-ink-500 mt-1 line-clamp-2 whitespace-pre-wrap">
                      {ticket.description}
                    </p>
                    {ticket.resolution ? (
                      <p className="text-sm text-emerald-700 mt-1">
                        Reply: {ticket.resolution}
                      </p>
                    ) : null}
                    <p className="text-xs text-ink-500 mt-1">
                      {new Date(ticket.created_at).toLocaleString()}
                    </p>
                  </div>
                  <TicketStatusControl
                    ticketId={ticket.id}
                    status={ticket.status}
                    resolution={ticket.resolution}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
