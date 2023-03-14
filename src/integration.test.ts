import { describe, expect, test } from '@jest/globals'

import config from '../config.json'

import * as core from '../src/core'
import { InMemStore, startServer } from './server'

const testURL = `http://localhost:${config.port}`

describe('server', () => {
    test('starts and stops without error', async () => {
        const store = new InMemStore()
        const logger = (lvl: core.LogLevels, msg: string) => { }
        const server = startServer(logger, store)
        await server.stop()
    })
})
