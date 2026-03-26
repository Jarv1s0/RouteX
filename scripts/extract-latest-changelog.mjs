import fs from 'node:fs'
import path from 'node:path'

const [, , sourceArg = 'changelog.md', outputArg] = process.argv

const sourcePath = path.resolve(sourceArg)
const raw = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n').trim()

const versionHeadingPattern = /^(#{2,6})\s+v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\s*$/gm
const headingMatches = [...raw.matchAll(versionHeadingPattern)]

if (headingMatches.length === 0) {
  throw new Error(`No version section found in ${sourceArg}`)
}

const latestStart = headingMatches[0].index ?? 0
const nextHeading = headingMatches[1]
const latestEnd = nextHeading?.index ?? raw.length
const latestSection = raw.slice(latestStart, latestEnd).trim()
const latestLines = latestSection.split('\n')

if (latestLines.length === 0) {
  throw new Error(`Latest changelog section is empty in ${sourceArg}`)
}

const releaseNotesBody = latestLines.slice(1).join('\n').trim()

if (!releaseNotesBody) {
  throw new Error(`Latest changelog section has no body in ${sourceArg}`)
}

const releaseNotes = `# 更新日志\n\n${releaseNotesBody}\n`

if (outputArg) {
  const outputPath = path.resolve(outputArg)
  fs.writeFileSync(outputPath, releaseNotes)
} else {
  process.stdout.write(releaseNotes)
}
