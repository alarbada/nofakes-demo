import * as esbuild from 'esbuild'
import { globSync } from 'glob'

const serverEntryPoint = 'src/server.ts'
const serverCtx = await esbuild.context({
    entryPoints: [serverEntryPoint],
    bundle: true,
    sourcemap: true,
    platform: 'node',
    target: ['node18'],
    outfile: 'dist/server.js',
})

const testsEntryPoints = 'src/**/*.test.ts'
const testsCtx = await esbuild.context({
    bundle: true,
    sourcemap: true,
    target: 'es2015',
    format: 'cjs',
    outdir: '__tests__',
    // Jest panics if it sees a require('@jest/globals') call in a test file,
    // so we need to tell esbuild to exclude it from the bundle.
    external: ['@jest/globals'],
    entryPoints: globSync(testsEntryPoints),
})

await serverCtx.watch()
console.log('Watching', serverEntryPoint)

await testsCtx.watch()
console.log('Watching', testsEntryPoints)

