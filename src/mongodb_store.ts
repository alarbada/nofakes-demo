import * as mongo from 'mongodb'

import * as core from './core'
import config from './config'
import { assertNever } from './utils'

const url = `mongodb+srv://${config.mongo.user}:${config.mongo.password}@localhost/?retryWrites=true&w=majority`

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
    _id?: number
}
type PhysicalBusiness = Omit<core.PhysicalBusiness, 'id'> & {
    type: 'physical'
    _id?: number
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
                    id,
                    ...doc,
                },
            }
        }
        if (doc.type === 'physical') {
            return {
                type: doc.type,
                value: {
                    id,
                    ...doc,
                },
            }
        }

        assertNever(doc)
    },
}

export async function mongoDbStore(): Promise<core.BusinessRepository> {
    const client = new mongo.MongoClient(url)

    const conn = await client.connect()
    const businessCol = conn
        .db(config.mongo.dbName)
        .collection<MongoBusinessDoc>('business')

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
                    latest_reviews: [],
                })

                return {
                    type: 'success',
                    value: {
                        id: insertedId,
                        name: data.name,
                        website: data.website,
                        email: data.email,
                        total_reviews: 0,
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
                    latest_reviews: [],
                })

                return {
                    type: 'success',
                    value: {
                        id: insertedId,
                        name: data.name,
                        address: data.address,
                        phone: data.phone,
                        email: data.email,
                        total_reviews: 0,
                        latest_reviews: [],
                    },
                }
            } catch (err) {
                return handleMongoErr(err)
            }
        },

        async getBusiness(
            id: number
        ): core.RepositoryFetchResult<core.Business> {
            try {
                const result = await businessCol.findOne({ _id: id })
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
            businessId: number,
            data: core.CreateReviewData
        ): core.RepositoryEditResult<core.Review> {
            try {
                const newReview: core.Review = {
                    business_id: businessId,
                    creation_date: new Date(),
                    ...data,
                }

                const query = { _id: businessId }
                const result = await businessCol.updateOne(query, {
                    $push: { 'latest_reviews.$[]': data },
                })

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
