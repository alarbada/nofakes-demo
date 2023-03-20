import { z } from 'zod'

// This little helper function will help us with exhaustiveness type checking
function assertNever(x: never): never {
    throw new Error('Unexpected object: ' + x)
}

// The necessary input to create a new online business record
const createOnlineBusinessInput = z.object({
    name: z.string(),
    website: z.string(),
    email: z.string(),
})

export type CreateOnlineBusinessInput = z.infer<
    typeof createOnlineBusinessInput
>

// All data that represents an online business record
export type OnlineBusiness = {
    id: string
    name: string
    website: string
    email: string
    total_reviews: number
    latest_reviews: Review[]
}

// The necessary input to create a new physical business record
export const createPhysicalBusinessInput = z.object({
    name: z.string(),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
})

export type CreatePhysicalBusinessInput = z.infer<
    typeof createPhysicalBusinessInput
>

// All data that represents a physical business record
export type PhysicalBusiness = {
    id: string
    name: string
    address: string
    phone: string
    email: string
    total_reviews: number
    latest_reviews: Review[]
}

export const createBusinessInput = z.discriminatedUnion('type', [
    z.object({ type: z.literal('online'), value: createOnlineBusinessInput }),
    z.object({
        type: z.literal('physical'),
        value: createPhysicalBusinessInput,
    }),
])

// All allowed inputs that can be used to create a new business record
export type CreateBusinessInput = z.infer<typeof createBusinessInput>

// All possible business records. This may or may not be converted to a discriminated union,
// right now we just use this type to serialize all business info types to JSON.
export type Business =
    | { type: 'online'; value: OnlineBusiness }
    | { type: 'physical'; value: PhysicalBusiness }

export type LogLevels = 'info' | 'error' | 'warn' | 'debug'
export type Logger = (lvl: LogLevels, msg: string) => void

export const createReviewInput = z.object({
    text: z.string(),
    rating: z.number(),
    username: z.string(),
})

export type CreateReviewInput = z.infer<typeof createReviewInput>

export type Review = {
    // "business_id" is not explicitly defined in the requirements,
    // but we need it in order to get reviews of a business
    business_id: string

    text: string
    rating: number
    username: string
    creation_date: Date
}

// represents the response after editing a record of the database layer
export type RepositoryEditResult<T> = Promise<
    { type: 'success'; value: T } | { type: 'database_error'; error: Error }
>

export type RepositoryFetchResult<T> = Promise<
    | { type: 'success'; value: T }
    | { type: 'record_not_found' }
    | { type: 'database_error'; error: Error }
>

export type BusinessRepository = {
    createOnlineBusiness: (
        data: CreateOnlineBusinessInput
    ) => RepositoryEditResult<OnlineBusiness>
    createPhysicalBusiness: (
        data: CreatePhysicalBusinessInput
    ) => RepositoryEditResult<PhysicalBusiness>

    getBusiness: (id: string) => RepositoryFetchResult<Business>

    createReview: (
        businessId: string,
        data: CreateReviewInput
    ) => RepositoryEditResult<Review>
}

// Operations will hold all core operations that can be performed on our REST API
export class Operations {
    constructor(public db: BusinessRepository, public log: Logger) {}

    // createBusiness will create a new business record, and return an error if the business
    // has an invalid name.
    async createBusiness(input: CreateBusinessInput): Promise<void | Error> {
        if (input.type === 'online') {
            const business = input.value
            if (business.name.length > 75) {
                return new Error(`Business name is too long`)
            }

            const result = await this.db.createOnlineBusiness(business)
            if (result.type === 'database_error') {
                return new Error(`Database error: ${result.error.message}`)
            }
            if (result.type === 'success') {
                this.log('info', `Created new business ${result.value.name}`)
                return
            }
            assertNever(result)
        } else if (input.type === 'physical') {
            const business = input.value
            if (business.name.length > 50) {
                return new Error(`Business name is too long`)
            }

            const result = await this.db.createPhysicalBusiness(business)
            if (result.type === 'database_error') {
                return new Error(`Database error: ${result.error.message}`)
            }

            if (result.type === 'success') {
                this.log('info', `Created new business ${result.value.name}`)
                return
            }

            assertNever(result)
        }

        assertNever(input)
    }

    // createReview will create a new review for a business, and return an error if the review
    // is invalid.
    async createReview(
        businessId: string,
        input: CreateReviewInput
    ): Promise<void | Error> {
        if (input.text.length < 20) {
            return new Error('Review text is too short')
        } else if (input.text.length > 500) {
            return new Error('Review text is too long')
        }

        // Rating. Between 1 and 5. Without decimals.
        if (input.rating < 1 || input.rating > 5) {
            return new Error('Rating is out of range')
        } else if (input.rating % 1 !== 0) {
            return new Error('Rating must be an integer')
        }

        const result = await this.db.createReview(businessId, input)
        if (result.type === 'database_error') {
            return new Error(`Database error: ${result.error.message}`)
        }

        if (result.type === 'success') {
            this.log('info', `Created new review for business ${businessId}`)
            return
        }

        assertNever(result)
    }
}
