import { getAgentQueue } from '@/services/agent.service';
import { PageFrame } from '../_components/page-frame';
import { PageHeader } from '../_components/page-header';
import { AgentQueue } from './_components/agent-queue';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  const rows = await getAgentQueue();
  const ready = rows.filter((row) => row.gate === 'ready').length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Command"
        title="Relationship agent"
        subtitle={`${ready} shops are ready for one approved question. A reply changes the next question. Two ignores pause the shop for 21 days. After 7 days we record whether the shop did the step.`}
      />
      <AgentQueue rows={rows} />
    </PageFrame>
  );
}
