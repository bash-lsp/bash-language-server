import { z } from 'zod'

const ReplacementSchema = z.object({
  precedence: z.number(),
  line: z.number(),
  endLine: z.number(),
  column: z.number(),
  endColumn: z.number(),
  insertionPoint: z.string(),
  replacement: z.string(),
})

// https://github.com/koalaman/shellcheck/blob/364c33395e2f2d5500307f01989f70241c247d5a/src/ShellCheck/Formatter/Format.hs#L50
const LevelSchema = z.enum(['error', 'warning', 'info', 'style'])

// Constituent structures defined here:
// https://github.com/koalaman/shellcheck/blob/master/src/ShellCheck/Interface.hs

export const ShellCheckResultSchema = z.object({
  comments: z.array(
    z.object({
      file: z.string(),
      line: z.number(), // 1-based
      endLine: z.number(), // 1-based
      column: z.number(), // 1-based
      endColumn: z.number(), // 1-based
      level: LevelSchema,
      code: z.number(),
      message: z.string(),
      fix: z
        .object({
          replacements: z.array(ReplacementSchema),
        })
        .nullable(),
    }),
  ),
})
export type ShellCheckResult = z.infer<typeof ShellCheckResultSchema>
export type ShellCheckComment = ShellCheckResult['comments'][number]
export type ShellCheckCommentLevel = z.infer<typeof LevelSchema>
export type ShellCheckReplacement = z.infer<typeof ReplacementSchema>
