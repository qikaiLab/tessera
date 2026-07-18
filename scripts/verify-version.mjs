import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'))
}

function fail(message) {
  console.error(`Version check failed: ${message}`)
  process.exitCode = 1
}

const packageJson = readJson('package.json')
const packageLock = readJson('package-lock.json')
const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8')
const releaseNotes = fs.readFileSync(path.join(rootDir, 'RELEASE_NOTES.md'), 'utf8')
const version = packageJson.version
const expectedTag = `v${version}`

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`package.json version is not valid SemVer: ${version}`)
}
if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) {
  fail('package-lock.json does not match package.json')
}
if (!readme.includes(`version-${version}-blue`)) {
  fail(`README version badge is not ${version}`)
}
if (!readme.includes(`### ${expectedTag}`)) {
  fail(`README changelog has no ${expectedTag} section`)
}
if (!releaseNotes.startsWith(`# MotoTrace ${expectedTag}`)) {
  fail(`RELEASE_NOTES.md does not start with MotoTrace ${expectedTag}`)
}

const explicitTag = process.argv.find(arg => arg.startsWith('--tag='))?.slice('--tag='.length)
const releaseTag = explicitTag || process.env.GITHUB_REF_NAME
if (releaseTag?.startsWith('v') && releaseTag !== expectedTag) {
  fail(`release tag ${releaseTag} does not match ${expectedTag}`)
}

if (!process.exitCode) {
  console.log(`Version metadata is consistent: ${expectedTag}`)
}
