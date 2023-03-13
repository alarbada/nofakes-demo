import { z } from 'zod'

// This little helper function will help us with exhaustiveness type checking
function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}

// The necessary input to create a new online business record
const createOnlineBusinessInput = z.object({
    name: z.string(),
    website: z.string(),
    email: z.string(),
})

export type CreateOnlineBusinessInput = z.infer<typeof createOnlineBusinessInput>

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

export type CreatePhysicalBusinessInput = z.infer<typeof createPhysicalBusinessInput>

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
    z.object({ type: z.literal('physical'), value: createPhysicalBusinessInput }),
])

// All allowed inputs that can be used to create a new business record
export type CreateBusinessInput = z.infer<typeof createBusinessInput>

// All possible business records. This may or may not be converted to a discriminated union,
// right now we just use this type to serialize all business info types to JSON.
export type Business = OnlineBusiness | PhysicalBusiness

// The business repository interface. This is the interface that the business operations will use
// to interact with an external database. Note that the business operations will not know anything
// about the database implementation, so we can swap out the database implementation without
// having to change any business operations.
export type BusinessRepository = {
    createOnlineBusiness: (data: CreateOnlineBusinessInput) => Promise<OnlineBusiness | Error>
    createPhysicalBusiness: (data: CreatePhysicalBusinessInput) => Promise<PhysicalBusiness | Error>

    getBusiness: (id: string) => Promise<OnlineBusiness | PhysicalBusiness | Error>
}

export type LogLevels = 'info' | 'error' | 'warn' | 'debug'
export type Logger = (lvl: LogLevels, msg: string) => void

export class BusinessOperations {
    // Here we use the constructor to inject the dependencies
    constructor(
        public db: BusinessRepository,
        public log: Logger
    ) { }

    // createBusiness will run the corresponding core logic to add new business data.
    async createBusiness(input: CreateBusinessInput): Promise<void | Error> {
        if (input.type === 'online') {
            const business = input.value
            if (business.name.length > 75) {
                return new Error(`Business name is too long`)
            }

            const result = await this.db.createOnlineBusiness(business)
            if (result instanceof Error) return result

            this.log('info', `Created new business ${result.name}`)
            return
        } else if (input.type === 'physical') {
            const business = input.value
            if (business.name.length > 50) {
                return new Error(`Business name is too long`)
            }

            const result = await this.db.createPhysicalBusiness(business)
            if (result instanceof Error) return result

            this.log('info', `Created new business ${result.name}`)
            return
        }

        assertNever(input)
    }

    // getBusiness will run the corresponding core logic to retrieve business data.
    async getBusiness(businessId: string): Promise<Business | Error> {
        const result = await this.db.getBusiness(businessId)
        if (result instanceof Error) return result

        this.log('info', `Retrieved business ${result.name}`)
        return result
    }
}
