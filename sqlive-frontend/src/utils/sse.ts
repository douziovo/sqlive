/**
 * Lightweight SSE stream reader. Parses the SSE wire format (line-based,
 * field:value, blank-line-delimited events) and calls onEvent with the
 * joined data lines whenever a complete event is received.
 */
export async function readSseStream(
  response: Response,
  onEvent: (data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let pendingData: string[] = [];
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;

    if (!done) {
      buffer += decoder.decode(result.value, { stream: true });
    }

    let eolIndex: number;
    while ((eolIndex = buffer.search(/\r\n|\n|\r/)) !== -1) {
      // If \r is the last char, wait for next chunk to check for \r\n
      if (buffer[eolIndex] === '\r' && eolIndex === buffer.length - 1 && !done) {
        break;
      }

      const isCrLf = buffer[eolIndex] === '\r' && buffer[eolIndex + 1] === '\n';
      const lineEndLength = isCrLf ? 2 : 1;
      const line = buffer.slice(0, eolIndex);
      buffer = buffer.slice(eolIndex + lineEndLength);

      if (line.length === 0) {
        if (pendingData.length > 0) {
          onEvent(pendingData.join('\n'));
          pendingData = [];
        }
        continue;
      }

      // Skip comment lines (SSE spec: lines starting with ':')
      if (line.startsWith(':')) continue;

      const colonIndex = line.indexOf(':');
      let field = '';
      let fieldValue = '';

      if (colonIndex !== -1) {
        field = line.slice(0, colonIndex);
        const rawValue = line.slice(colonIndex + 1);
        fieldValue = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
      } else {
        field = line;
      }

      if (field === 'data') {
        pendingData.push(fieldValue);
      }
    }
  }

  signal?.throwIfAborted();
}
