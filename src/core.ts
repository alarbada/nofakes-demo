// All data that represents an online business record
export type OnlineBusiness = {
    id: string
    name: string
    website: string
    email: string
    total_reviews: number
    latest_reviews: Review[]
}

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

// All possible business records. This may or may not be converted to a discriminated union,
// right now we just use this type to serialize all business info types to JSON.
export type Business =
    | { type: 'online'; value: OnlineBusiness }
    | { type: 'physical'; value: PhysicalBusiness }

export type LogLevels = 'info' | 'error' | 'warn' | 'debug'
export type Logger = (lvl: LogLevels, msg: string) => void

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

type CreateOnlineBusinessData = {
    name: string
    website: string
    email: string
}

type CreatePhysicalBusinessData = {
    name: string
    address: string
    phone: string
    email: string
}

type CreateReviewData = {
    text: string,
    rating: number,
    username: string,
}

export type BusinessRepository = {
    createOnlineBusiness: (
        data: CreateOnlineBusinessData
    ) => RepositoryEditResult<OnlineBusiness>
    createPhysicalBusiness: (
        data: CreatePhysicalBusinessData
    ) => RepositoryEditResult<PhysicalBusiness>

    getBusiness: (id: string) => RepositoryFetchResult<Business>

    createReview: (
        businessId: string,
        data: CreateReviewData
    ) => RepositoryEditResult<Review>
}
