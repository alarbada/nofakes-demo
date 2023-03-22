import * as mongo from 'mongodb'

import * as core from './core'
import config from './config'
import { assertNever } from './utils'

const url = `mongodb://${config.mongo.user}:${config.mongo.password}@localhost:27017/?retryWrites=true&w=majority`

function handleMongoErr(err: unknown) {
    if (err instanceof Error) {
        return { type: 'database_error', error: err } as const
    }

    // Another unexpected error, so just throw up the chain
    throw err
}

// We can use the _id automatic mongo property for our identification needs.
// The REST API shall not know about this, this task is part of the database layer.
// Find more info at:
// https://www.mongodb.com/docs/drivers/node/current/fundamentals/typescript/#working-with-the-_id-field
type OnlineBusiness = Omit<core.OnlineBusiness, 'id'> & {
    type: 'online'
    _id?: mongo.ObjectId
}
type PhysicalBusiness = Omit<core.PhysicalBusiness, 'id'> & {
    type: 'physical'
    _id?: mongo.ObjectId
}

type MongoBusinessDoc = OnlineBusiness | PhysicalBusiness

const MongoBusinessCollection = {
    toBusiness(doc: MongoBusinessDoc): core.Business {
        const id = doc._id
        if (id === undefined) {
            throw new Error('detected undefined id')
        }

        if (doc.type === 'online') {
            return {
                type: doc.type,
                value: {
                    ...doc,
                    id: id.toString(),
                },
            }
        }
        if (doc.type === 'physical') {
            return {
                type: doc.type,
                value: {
                    ...doc,
                    id: id.toString(),
                },
            }
        }

        assertNever(doc)
    },
}


// This is useful to close all opened connections on our tests
let totalConnections: mongo.MongoClient[] = []

export async function closeAllConns() {
    for (const conn of totalConnections) {
        await conn.close()
    }

    totalConnections = []
}

export async function getBusinessCol(dbName?: string) {
    const client = new mongo.MongoClient(url)

    const conn = await client.connect()
    totalConnections.push(conn)

    if (dbName === undefined) {
        dbName = config.mongo.dbName
    }

    const businessCol = conn.db(dbName).collection<MongoBusinessDoc>('business')

    return businessCol
}

export async function createMongoDbStore(
    dbName?: string
): Promise<core.BusinessRepository> {
    const businessCol = await getBusinessCol(dbName)

    return {
        async createOnlineBusiness(
            data: core.CreateOnlineBusinessData
        ): core.RepositoryEditResult<core.OnlineBusiness> {
            try {
                const { insertedId } = await businessCol.insertOne({
                    type: 'online',
                    name: data.name,
                    website: data.website,
                    email: data.email,
                    total_reviews: 0,
                    avg_rating: 0,
                    latest_reviews: [],
                })

                return {
                    type: 'success',
                    value: {
                        id: insertedId.toString(),
                        name: data.name,
                        website: data.website,
                        email: data.email,
                        total_reviews: 0,
                        avg_rating: 0,
                        latest_reviews: [],
                    },
                }
            } catch (err) {
                return handleMongoErr(err)
            }
        },

        async createPhysicalBusiness(
            data: core.CreatePhysicalBusinessData
        ): core.RepositoryEditResult<core.PhysicalBusiness> {
            try {
                const { insertedId } = await businessCol.insertOne({
                    type: 'physical',
                    name: data.name,
                    address: data.address,
                    phone: data.phone,
                    email: data.email,
                    total_reviews: 0,
                    avg_rating: 0,
                    latest_reviews: [],
                })

                return {
                    type: 'success',
                    value: {
                        id: insertedId.toString(),
                        name: data.name,
                        address: data.address,
                        phone: data.phone,
                        email: data.email,
                        total_reviews: 0,
                        avg_rating: 0,
                        latest_reviews: [],
                    },
                }
            } catch (err) {
                return handleMongoErr(err)
            }
        },

        async getBusiness(
            id: core.BusinessId
        ): core.RepositoryFetchResult<core.Business> {
            try {
                const mongoId = mongo.ObjectId.createFromHexString(id)
                const result = await businessCol.findOne({ _id: mongoId })
                if (result === null) {
                    return { type: 'record_not_found' }
                }

                return {
                    type: 'success',
                    value: MongoBusinessCollection.toBusiness(result),
                }
            } catch (err) {
                return handleMongoErr(err)
            }
        },
        async createReview(
            businessId: core.BusinessId,
            data: core.CreateReviewData
        ): core.RepositoryEditResult<core.Review> {
            try {
                const newReview: core.Review = {
                    business_id: businessId,
                    creation_date: new Date(),
                    ...data,
                }

                const mongoId = mongo.ObjectId.createFromHexString(businessId)

                const query = { _id: mongoId }

                // I am fully aware that this is not efficient at all, two queries instead of one,
                // but I spent far too long on this challenge.

                const business = await businessCol.findOne(query)
                if (business === null) {
                    return {
                        type: 'database_error',
                        error: new Error('business does not exist'),
                    }
                }

                business.latest_reviews.push({
                    ...data,
                    business_id: businessId,
                    creation_date: new Date(),
                })
                const ratingsSum = business.latest_reviews.reduce(
                    (prev, curr) => prev + curr.rating,
                    0
                )

                const totalReviews = business.latest_reviews.length
                let avgRating = 0
                if (totalReviews !== 0) {
                    avgRating = ratingsSum / totalReviews
                    avgRating = Math.floor(avgRating * 10) / 10
                }

                business.total_reviews = totalReviews
                business.avg_rating = avgRating

                await businessCol.replaceOne(query, business)

                return {
                    type: 'success',
                    value: newReview,
                }
            } catch (err) {
                return handleMongoErr(err)
            }
        },
    }
}
