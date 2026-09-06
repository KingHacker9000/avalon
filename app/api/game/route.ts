import { execute } from '@/lib/game/store';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
};
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== new URL(request.url).host)
      return Response.json(
        { error: 'Use this game from its own website.' },
        { status: 403, headers },
      );
    if (!request.headers.get('content-type')?.includes('application/json'))
      return Response.json({ error: 'Send JSON.' }, { status: 415, headers });
    if (Number(request.headers.get('content-length')) > 8192)
      return Response.json(
        { error: 'Request too large.' },
        { status: 413, headers },
      );
    const reader = request.body?.getReader();
    let raw = '';
    let length = 0;
    const decoder = new TextDecoder();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 8192) {
          await reader.cancel();
          return Response.json(
            { error: 'Request too large.' },
            { status: 413, headers },
          );
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    }
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return Response.json(
        { error: 'Invalid JSON.' },
        { status: 400, headers },
      );
    }
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return Response.json(
        { error: 'Invalid action.' },
        { status: 400, headers },
      );
    const secret =
      request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    return Response.json(execute(input, secret), { headers });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to complete that action.';
    if (/SQLITE|database|ENOENT|EACCES/i.test(message)) {
      console.error('Game storage error', error);
      return Response.json(
        { error: 'The table is temporarily unavailable. Try again shortly.' },
        { status: 503, headers },
      );
    }
    return Response.json({ error: message }, { status: 400, headers });
  }
}
