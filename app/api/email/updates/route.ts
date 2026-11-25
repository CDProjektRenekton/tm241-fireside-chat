import { createUpdate, getUpdate, listRegistrations, listUpdates, saveUpdateContent, setUpdateStatus } from '@/lib/airtable';
import { audienceCounts, normalizeUpdate, planUpdate, summarizeUpdate, validateUpdate } from '@/lib/updates';
import { failure, refuse, reply } from '@/lib/updates-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Every draft and sent update, with how far each got, and the size of each audience. */
export async function GET(req: Request) {
  const no = await refuse(req, false);
  if (no) return no;
  try {
    const [updates, rows] = await Promise.all([listUpdates(), listRegistrations()]);
    return reply({
      updates: updates.map((u) => ({ ...u, summary: summarizeUpdate(planUpdate(rows, u)) })),
      audiences: audienceCounts(rows),
    });
  } catch (e) {
    return failure('email/updates', e);
  }
}

/**
 * Saves a draft: { content } makes a new one, { id, content } changes one, { id, discard: true } puts
 * one away. Emails nobody. Once an update has started going out, its words can't change any more.
 */
export async function POST(req: Request) {
  const no = await refuse(req);
  if (no) return no;
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; content?: unknown; discard?: unknown };
  try {
    let update;
    if (typeof body.id === 'string' && body.id) {
      const current = await getUpdate(body.id);
      if (!current) return reply({ message: 'This update no longer exists.' }, 404);
      if (current.status !== 'Draft') {
        return reply({ message: 'This update has already started going out, so it can no longer be changed. Use it as a new draft instead.' }, 409);
      }
      if (body.discard === true) {
        await setUpdateStatus(current.id, 'Discarded');
        return reply({ ok: true });
      }
      update = await saveUpdateContent(current.id, normalizeUpdate(body.content));
    } else {
      update = await createUpdate(normalizeUpdate(body.content));
    }
    const summary = summarizeUpdate(planUpdate(await listRegistrations(), update));
    return reply({ update: { ...update, summary }, errors: validateUpdate(update) });
  } catch (e) {
    return failure('email/updates', e);
  }
}
