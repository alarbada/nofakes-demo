import { describe, expect, test } from '@jest/globals'

import config from '../config.json'

import * as core from '../src/core'
import { createInMemDb, startServer } from './server'

const testURL = `http://localhost:${config.port}`

describe('server', () => {
    test('starts and stops without error', async () => {
        const logger = (lvl: core.LogLevels, msg: string) => { }
        const store = createInMemDb()
        const server = startServer(logger, store)
        await server.stop()
    })
})
