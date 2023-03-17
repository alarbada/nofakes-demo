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
export type Business = OnlineBusiness | PhysicalBusiness

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
}

export type RepositoryCreateResult<T> = Promise<
    { type: 'success'; value: T } | { type: 'database_error'; error: Error }
>

export type RepositoryFetchResult<T> = Promise<
    | { type: 'success'; value: T }
    | { type: 'record_not_found' }
    | { type: 'database_error'; error: Error }
>

export type ReviewRepository = {
    createReview: (
        businessId: string,
        data: CreateReviewInput
    ) => RepositoryCreateResult<Review>
}

export type BusinessRepository = {
    createOnlineBusiness: (
        data: CreateOnlineBusinessInput
    ) => RepositoryCreateResult<OnlineBusiness>
    createPhysicalBusiness: (
        data: CreatePhysicalBusinessInput
    ) => RepositoryCreateResult<PhysicalBusiness>

    getBusiness: (
        id: string
    ) => RepositoryFetchResult<OnlineBusiness | PhysicalBusiness>
}

// All repositories used in our REST API. This is the interface that the business operations will use
// to interact with an external database. Note that the repositories will not know anything
// about the database implementation, so we can swap out database implementations without
// having to change much core logic.
export type Repositories = {
    business: BusinessRepository
    reviews: ReviewRepository
}

// Operations will hold all core operations that can be performed on our REST API
export class Operations {
    constructor(public db: Repositories, public log: Logger) {}

    // createBusiness will create a new business record, and return an error if the business
    // has an invalid name.
    async createBusiness(input: CreateBusinessInput): Promise<void | Error> {
        if (input.type === 'online') {
            const business = input.value
            if (business.name.length > 75) {
                return new Error(`Business name is too long`)
            }

            const result = await this.db.business.createOnlineBusiness(business)
            switch (result.type) {
                case 'database_error':
                    return new Error(`Database error: ${result.error.message}`)
                case 'success':
                    this.log(
                        'info',
                        `Created new business ${result.value.name}`
                    )
                    return
                default:
                    assertNever(result)
            }
        } else if (input.type === 'physical') {
            const business = input.value
            if (business.name.length > 50) {
                return new Error(`Business name is too long`)
            }

            const result = await this.db.business.createPhysicalBusiness(
                business
            )
            switch (result.type) {
                case 'database_error':
                    return new Error(`Database error: ${result.error.message}`)
                case 'success':
                    break
                default:
                    assertNever(result)
            }

            this.log('info', `Created new business ${result.value.name}`)
            return
        }

        assertNever(input)
    }

    // getBusiness will return a business record, or an error if the business does not exist.
    async getBusiness(businessId: string): Promise<Business | Error> {
        const result = await this.db.business.getBusiness(businessId)
        switch (result.type) {
            case 'database_error':
                return new Error(`Database error: ${result.error.message}`)
            case 'record_not_found':
                return new Error(`Business not found`)
            case 'success':
                break
            default:
                assertNever(result)
        }

        this.log('info', `Retrieved business ${result.value.name}`)
        return result.value
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

        const result = await this.db.reviews.createReview(businessId, input)
        switch (result.type) {
            case 'database_error':
                return new Error(`Database error: ${result.error.message}`)
            case 'success':
                break
            default:
                assertNever(result)
        }

        this.log('info', `Created new review for business ${businessId}`)
        return
    }
}
