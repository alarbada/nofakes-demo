import { describe, expect, test } from '@jest/globals'

import { startServer } from './server'

describe('server', () => {
    test('starts and stops without error', async () => {
        const server = startServer()
        await server.stop()
    })
})
