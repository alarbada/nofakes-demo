import fs from 'fs'

// We don't need to handle errors here, because we don't care whether the directories exist
try {
    fs.rmSync('./dist', { recursive: true })
} catch {}

try {
    fs.rmSync('./__tests__', { recursive: true })
} catch {}

