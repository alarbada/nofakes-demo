import { describe, expect, test } from '@jest/globals'

import config from '../config.json'

import * as core from '../src/core'
import { createInMemDb, startServer } from './server'

const testURL = `http://localhost:${config.port}`

describe('server', () => {
    const logger = (lvl: core.LogLevels, msg: string) => { }
    const store = createInMemDb()
    const server = startServer(logger, store)
    afterAll(async () => {
        await server.stop()
    })

    test('returns 404 for non-existent business', async () => {
        const response = await fetch(`${testURL}/business/1`)
        expect(response.status).toBe(404)
    })
})

