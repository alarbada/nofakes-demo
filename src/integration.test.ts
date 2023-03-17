import { describe, expect, test } from '@jest/globals'
import http from 'http'

import fetch from 'node-fetch'

import config from '../config.json'

import * as core from '../src/core'
import { createInMemDb, startServer } from './server'

const testURL = `http://localhost:${config.port}`

describe('integration tests', () => {
    test('returns 404 for non-existent business', async () => {
        const logger = (lvl: core.LogLevels, msg: string) => {}
        const store = createInMemDb()
        const startedServer = startServer(logger, store)

        const response = await fetch(`${testURL}/business/1`)
        expect(response.status).toBe(404)

        await startedServer.stop()
    })

    test('returns 200 for existing business with its corresponding details', async () => {
        const logger = (lvl: core.LogLevels, msg: string) => {}
        const inmemStore = createInMemDb()
        const onlineBusinessRes = await inmemStore.business.createOnlineBusiness({
            name: 'test',
            email: 'test@test.com',
            website: 'test.com'
        })
        if (onlineBusinessRes.type !== 'success') throw new Error('Failed to create business')

        const physicalBusiness = await inmemStore.business.createPhysicalBusiness({
            name: 'test',
            email: 'test@test.com',
            phone: '1234567890',
            address: '123 test st',
        })
        if (physicalBusiness.type !== 'success') throw new Error('Failed to create business')

        const startedServer = startServer(logger, inmemStore)

        let response = await fetch(`${testURL}/business/${onlineBusinessRes.value.id}`)
        expect(response.status).toBe(200)

        response = await fetch(`${testURL}/business/${physicalBusiness.value.id}`)
        expect(response.status).toBe(200)

        await startedServer.stop()
    })
})
