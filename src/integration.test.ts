import { describe, expect, test } from '@jest/globals'

import fetch from 'node-fetch'

import config from './config'

import * as core from '../src/core'
import { startServer } from './server'
import { createInMemDb } from './inmem_store'
import { createMongoDbStore, getBusinessCol, closeAllConns } from './mongodb_store'

const testURL = `http://localhost:${config.port}`

describe('inmem store tests', () => {
    // eslint-disable-next-line
    const logger = (_lvl: core.LogLevels, _msg: string) => {}

    // eslint-disable-next-line
    let stopServer = async () => {}
    afterEach(async () => {
        await stopServer()
    })

    test('returns 404 for non-existent business', async () => {
        const store = createInMemDb()
        const startedServer = startServer(logger, store)

        const response = await fetch(`${testURL}/business/1`)
        expect(response.status).toBe(404)

        await startedServer.stop()
    })

    test('returns 200 for existing business with its corresponding details', async () => {
        const inmemStore = createInMemDb()
        const onlineBusinessRes = await inmemStore.createOnlineBusiness({
            name: 'test',
            email: 'test@test.com',
            website: 'test.com',
        })
        if (onlineBusinessRes.type !== 'success')
            throw new Error('Failed to create business')

        const physicalBusiness = await inmemStore.createPhysicalBusiness({
            name: 'test',
            email: 'test@test.com',
            phone: '1234567890',
            address: '123 test st',
        })
        if (physicalBusiness.type !== 'success')
            throw new Error('Failed to create business')

        const startedServer = startServer(logger, inmemStore)
        stopServer = startedServer.stop

        {
            // online business
            const response = await fetch(
                `${testURL}/business/${onlineBusinessRes.value.id}`
            )
            expect(response.status).toBe(200)

            const json = await response.json()
            expect(json).toStrictEqual({
                type: 'online',
                id: '1',
                name: 'test',
                website: 'test.com',
                email: 'test@test.com',
                total_reviews: 0,
                avg_rating: 0,
                latest_reviews: [],
            })
        }

        {
            // physical business
            const response = await fetch(
                `${testURL}/business/${physicalBusiness.value.id}`
            )
            expect(response.status).toBe(200)

            const json = await response.json()
            expect(json).toStrictEqual({
                type: 'physical',
                id: '2',
                name: 'test',
                address: '123 test st',
                phone: '1234567890',
                email: 'test@test.com',
                total_reviews: 0,
                avg_rating: 0,
                latest_reviews: [],
            })
        }
    })

    test('create and retrieve reviews for a business correctly work', async () => {
        const inmemStore = createInMemDb()
        const onlineBusinessRes = await inmemStore.createOnlineBusiness({
            name: 'test',
            email: 'test@test.com',
            website: 'test.com',
        })
        if (onlineBusinessRes.type !== 'success')
            throw new Error('Failed to create business')

        const startedServer = startServer(logger, inmemStore)
        stopServer = startedServer.stop

        const createReview = (rating: number) => ({
            business_id: onlineBusinessRes.value.id,
            text: 'super amazing business review that will get to more than 20 characters long',
            rating,
            username: 'test user',
            creation_date: new Date(),
        })

        for (const rating of [1, 3, 4, 5]) {
            // sleep 5 ms to allow for differnt creation dates
            await new Promise((resolve) => setTimeout(resolve, 5))

            const review = createReview(rating)

            const response = await fetch(
                `${testURL}/business/${onlineBusinessRes.value.id}/reviews`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(review),
                }
            )

            expect(response.status).toBe(201)
        }

        // get reviews
        const response = await fetch(
            `${testURL}/business/${onlineBusinessRes.value.id}`
        )
        expect(response.status).toBe(200)

        // Yes, this is a bit hacky, but the reasoning is as follows.
        // If the ratings from the reviews match these outputs, that will
        // mean that they were properly inserted and sorted out.

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json: any = await response.json()
        expect(json.avg_rating).toBe(3.2)
        expect(json.latest_reviews[0].rating).toBe(5)
        expect(json.latest_reviews[1].rating).toBe(4)
        expect(json.latest_reviews[2].rating).toBe(3)
    })
})

describe('mongodb store tests', () => {

    afterAll(async () => {
        await closeAllConns()
    })

    test('All methods properly work', async () => {
        const testDbName = `${config.mongo.dbName}_test`

        // cleanup results from previous tests
        {
            const col = await getBusinessCol(testDbName)
            await col.deleteMany()
        }

        const store = await createMongoDbStore(testDbName)

        const physicalBusinessInput = {
            address: '123 test st',
            phone: '1234567890',
            email: 'test@test.com',
            name: 'test physical business',
        }

        const physicalBusiness = await (async () => {
            const res = await store.createPhysicalBusiness(
                physicalBusinessInput
            )
            if (res.type === 'database_error') throw res.error

            return res.value
        })()

        expect(physicalBusiness).toMatchObject(physicalBusinessInput)

        const onlineBusinessInput = {
            website: 'www.test.com',
            email: 'test@test.com',
            name: 'test online business',
        }

        const onlineBusiness = await (async () => {
            const res = await store.createOnlineBusiness(onlineBusinessInput)
            if (res.type === 'database_error') throw res.error

            return res.value
        })()

        expect(onlineBusiness).toMatchObject(onlineBusinessInput)

        {
            const res = await store.createReview(onlineBusiness.id, {
                text: 'test review',
                rating: 5,
                username: 'test user',
            })
            if (res.type === 'database_error') throw res.error
        }
        {
            const res = await store.createReview(onlineBusiness.id, {
                text: 'test review',
                rating: 3,
                username: 'test user',
            })
            if (res.type === 'database_error') throw res.error
        }
        {
            const res = await store.createReview(onlineBusiness.id, {
                text: 'test review',
                rating: 3,
                username: 'test user',
            })
            if (res.type === 'database_error') throw res.error
        }

        {
            const businessRes = await store.getBusiness(onlineBusiness.id)
            if (businessRes.type === 'database_error') throw businessRes.error
            if (businessRes.type === 'record_not_found')
                throw new Error('unreachable')

            const business = businessRes.value

            expect(business.value).toMatchObject({
                ...onlineBusiness,
                total_reviews: 3,
                latest_reviews: [
                    {
                        rating: 5,
                        text: 'test review',
                        username: 'test user',
                    },
                    {
                        rating: 3,
                        text: 'test review',
                        username: 'test user',
                    },
                    {
                        rating: 3,
                        text: 'test review',
                        username: 'test user',
                    },
                ],
                avg_rating: 3.6,
            })
        }
    })
})
