// Checks what `npm pack` would publish for each package: only the expected paths, and the
// files the `exports` map points at. Run after `pnpm build`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const packages = ['core', 'vue', 'react']
const allowed = [/^package\/(LICENSE|README\.md|package\.json)$/, /^package\/dist\/.+\.(js|d\.ts)$/, /^package\/resources\/boost\//]
const failures = []

for (const name of packages) {
  const dir = join('packages', name)
  const out = mkdtempSync(join(tmpdir(), `pack-${name}-`))
  try {
    execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: dir, stdio: 'ignore' })
    const tarball = join(out, readdirSync(out)[0])
    const files = execFileSync('tar', ['tzf', tarball], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && !f.endsWith('/'))

    for (const file of files) {
      if (!allowed.some((pattern) => pattern.test(file))) failures.push(`${name}: unexpected file ${file}`)
    }

    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const targets = Object.values(manifest.exports).flatMap((entry) => Object.values(entry))
    for (const target of targets) {
      if (!files.includes(`package/${String(target).replace(/^\.\//, '')}`)) {
        failures.push(`${name}: exports points at ${target}, which is not in the tarball`)
      }
    }
    console.log(`${name}: ${files.length} files`)
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
