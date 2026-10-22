import fs from 'node:fs'
import path from 'node:path'

const [, , sourceArg = 'changelog.md', outputArg, versionArg] = process.argv
const version = (
  versionArg ??
  JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
).replace(/^v/, '')
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

if (!versionPattern.test(version)) {
  throw new Error(`Invalid release version: ${version}`)
}

const sourcePath = path.resolve(sourceArg)
const raw = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n').trim()

const lines = raw.split('\n')
const headings = []
let fence = null

for (const [index, line] of lines.entries()) {
  const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
  if (fence) {
    if (
      marker &&
      marker[1][0] === fence.character &&
      marker[1].length >= fence.length &&
      !marker[2].trim()
    ) {
      fence = null
    }
    continue
  }
  if (marker) {
    fence = { character: marker[1][0], length: marker[1].length }
    continue
  }

  const heading = line.match(/^##[\t ]+(.+?)[\t ]*$/)
  if (heading) {
    headings.push({ index, title: heading[1] })
  }
}

const matches = headings.filter((heading) => heading.title === `v${version}`)

if (matches.length !== 1) {
  throw new Error(
    `Expected exactly one changelog section for v${version} in ${sourceArg}, found ${matches.length}`
  )
}

const selected = matches[0]
const nextHeading = headings[headings.indexOf(selected) + 1]
const releaseNotesBody = lines
  .slice(selected.index + 1, nextHeading?.index ?? lines.length)
  .join('\n')
  .trim()
const content = releaseNotesBody
  .replace(/<!--[\s\S]*?-->/g, '')
  .split('\n')
  .filter((line) => !/^#{1,6}\s/.test(line))
  .join('\n')
  .trim()

if (!content) {
  throw new Error(`Changelog section for v${version} has no body in ${sourceArg}`)
}

const releaseNotes = `# 更新日志\n\n${releaseNotesBody}\n`

if (outputArg) {
  const outputPath = path.resolve(outputArg)
  fs.writeFileSync(outputPath, releaseNotes)
} else {
  process.stdout.write(releaseNotes)
}
