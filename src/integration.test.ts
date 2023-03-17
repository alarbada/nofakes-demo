import { describe, expect, test } from '@jest/globals'

import fetch from 'node-fetch'

import config from '../config.json'

import * as core from '../src/core'
import { createInMemDb, startServer } from './server'

const testURL = `http://localhost:${config.port}`

describe('integration tests', () => {
    // eslint-disable-next-line
    const logger = (_lvl: core.LogLevels, _msg: string) => { }
    test('returns 404 for non-existent business', async () => {
        const store = createInMemDb()
        const startedServer = startServer(logger, store)

        const response = await fetch(`${testURL}/business/1`)
        expect(response.status).toBe(404)

        await startedServer.stop()
    })

    test('returns 200 for existing business with its corresponding details', async () => {
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

        { // online business
            const response = await fetch(`${testURL}/business/${onlineBusinessRes.value.id}`)
            expect(response.status).toBe(200)

            const json = await response.json()
            expect(json).toStrictEqual({
                id: '1',
                name: 'test',
                website: 'test.com',
                email: 'test@test.com',
                total_reviews: 0
            })
        }

        { // physical business
            const response = await fetch(`${testURL}/business/${physicalBusiness.value.id}`)
            expect(response.status).toBe(200)

            const json = await response.json()
            expect(json).toStrictEqual({
                id: '2',
                name: 'test',
                address: '123 test st',
                phone: '1234567890',
                email: 'test@test.com',
                total_reviews: 0
            })
        }

        await startedServer.stop()
    })

    test('create and retrieve reviews for a business correctly work', async () => {
        const inmemStore = createInMemDb()
        const onlineBusinessRes = await inmemStore.business.createOnlineBusiness({
            name: 'test',
            email: 'test@test.com',
            website: 'test.com'
        })
        if (onlineBusinessRes.type !== 'success') throw new Error('Failed to create business')

        const startedServer = startServer(logger, inmemStore)

        // add reviews
        for (let rating = 1; rating < 5; rating++) {
            const response = await fetch(`${testURL}/business/${onlineBusinessRes.value.id}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: 'super amazing business test test lets get to more than 20 chars',
                    rating,
                    username: 'test user 1',
                })
            })

            expect(response.status).toBe(200)
        }

        // get reviews
        const response = await fetch(`${testURL}/business/${onlineBusinessRes.value.id}`)
        expect(response.status).toBe(200)

        const json = await response.json()
        expect(json).toStrictEqual({
            id: '1',
            name: 'test',
            website: 'test.com',
            email: 'test@test.com',
            total_reviews: 4,
        })

        await startedServer.stop()
    })
})
