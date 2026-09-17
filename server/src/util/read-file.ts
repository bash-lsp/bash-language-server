import { constants, promises as fs } from 'node:fs'

export const MAX_ANALYZED_FILE_BYTES = 10 * 1024 * 1024

/** Bound background reads, including files replaced after workspace selection. */
export async function readFileForAnalysis(
  file: string | URL,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted()
  // A FIFO must not block open before we can reject it with fstat.
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0))
  try {
    signal?.throwIfAborted()
    // Inspect and read the same handle so a path replacement cannot bypass checks.
    const stat = await handle.stat()
    if (!stat.isFile()) throw new Error('Cannot analyze a non-regular file')
    if (stat.size > MAX_ANALYZED_FILE_BYTES)
      throw new Error(
        `Cannot analyze a file larger than ${MAX_ANALYZED_FILE_BYTES} bytes`,
      )

    signal?.throwIfAborted()
    // Read at most the original size, even if the file grows while being read.
    const content = Buffer.alloc(stat.size)
    let offset = 0
    while (offset < content.length) {
      signal?.throwIfAborted()
      const { bytesRead } = await handle.read(
        content,
        offset,
        content.length - offset,
        offset,
      )
      if (bytesRead === 0) break
      offset += bytesRead
    }
    return content.subarray(0, offset).toString('utf8')
  } finally {
    await handle.close()
  }
}
