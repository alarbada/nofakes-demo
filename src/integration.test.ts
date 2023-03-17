import { describe, expect, test } from '@jest/globals'
import http from 'http'

import fetch from 'node-fetch'

import config from '../config.json'

import * as core from '../src/core'
import { createInMemDb, startServer } from './server'

const testURL = `http://localhost:${config.port}`

describe('integration tests', () => {
    let server: http.Server
    let stopServer: () => Promise<void>

    // In this test store can be null so that we can override it at will on
    // each test if we want to
    let store: core.Repositories | null = null

    beforeEach(async () => {
        const logger = (lvl: core.LogLevels, msg: string) => {}
        if (store === null) {
            store = createInMemDb()
        }

        let started = startServer(logger, store!)
        server = started.server
        stopServer = started.stop
    })
    afterEach(async () => {
        await stopServer()
    })

    test('returns 404 for non-existent business', async () => {
        const response = await fetch(`${testURL}/business/1`)
        expect(response.status).toBe(404)
    })
})
