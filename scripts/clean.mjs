import fs from 'fs'

// This ensures a cross-platform way of removing old / dirty code,
// so that we can use it in our build npm scripts

// We don't need to handle errors here, because we don't care whether the directories exist
try {
    fs.rmSync('./dist', { recursive: true })
} catch {}

try {
    fs.rmSync('./__tests__', { recursive: true })
} catch {}

