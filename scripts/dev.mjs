import * as esbuild from 'esbuild'

const serverCtx = await esbuild.context({
    entryPoints: ['src/server.ts'],
    bundle: true,
    sourcemap: true,
    platform: 'node',
    target: ['node18'],
    outfile: 'dist/server.js',
})

await serverCtx.watch()
console.log('Watching src/server.ts')
