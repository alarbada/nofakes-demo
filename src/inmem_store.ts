import * as core from './core'

export function createInMemDb(): core.Repositories {
    const businesses: core.Business[] = []
    let businessIdCounter = 0

    const reviews: core.Review[] = []

    return {
        business: {
            async createOnlineBusiness(
                data: core.CreateOnlineBusinessInput
            ): core.RepositoryEditResult<core.OnlineBusiness> {
                businessIdCounter += 1

                const business: core.OnlineBusiness = {
                    id: businessIdCounter.toString(),
                    name: data.name,
                    website: data.website,
                    email: data.email,
                    total_reviews: 0,
                    latest_reviews: [],
                }
                businesses.push(business)

                return { type: 'success', value: business }
            },

            async createPhysicalBusiness(
                data: core.CreatePhysicalBusinessInput
            ): core.RepositoryEditResult<core.PhysicalBusiness> {
                businessIdCounter += 1

                const business: core.PhysicalBusiness = {
                    id: businessIdCounter.toString(),
                    name: data.name,
                    address: data.address,
                    phone: data.phone,
                    email: data.email,
                    total_reviews: 0,
                    latest_reviews: [],
                }
                businesses.push(business)

                return { type: 'success', value: business }
            },

            async getBusiness(
                id: string
            ): core.RepositoryFetchResult<core.Business> {
                const inMemBusiness = businesses.find((b) => b.id === id)
                if (!inMemBusiness) return { type: 'record_not_found' }

                // sort inMemBusiness.latest_reviews by date
                let sorted = inMemBusiness.latest_reviews.sort((prev, next) => {
                    const prevTime = prev.creation_date.getTime()
                    const nextTime = next.creation_date.getTime()
                    return nextTime - prevTime
                })

                // get the latest 3
                sorted = sorted.slice(0, 3)

                const business = {
                    ...inMemBusiness,
                    latest_reviews: sorted,
                }

                return { type: 'success', value: business }
            },
        },
        reviews: {
            async createReview(
                businessId: string,
                data: core.CreateReviewInput
            ): core.RepositoryEditResult<core.Review> {
                const business = businesses.find((b) => b.id === businessId)
                if (!business) {
                    return {
                        type: 'database_error',
                        error: new Error('Business not found'),
                    }
                }

                const newReview: core.Review = {
                    business_id: businessId,
                    username: data.username,
                    rating: data.rating,
                    text: data.text,
                    creation_date: new Date(),
                }
                reviews.push(newReview)

                business.total_reviews += 1
                business.latest_reviews.push(newReview)

                return { type: 'success', value: newReview }
            },
        },
    }
}
