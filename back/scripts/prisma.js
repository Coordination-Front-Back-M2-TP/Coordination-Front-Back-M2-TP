import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
const prismaCli = join(backDirectory, 'node_modules', 'prisma', 'build', 'index.js')
const schema = join(backDirectory, 'prisma', 'schema.prisma')
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2), '--schema', schema], {
  cwd: backDirectory,
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./prisma/dev.db' },
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
