import * as core from './core'

export function createInMemDb(): core.BusinessRepository {
    const businesses: core.Business[] = []
    let businessIdCounter = 0

    const reviews: core.Review[] = []

    return {
        async createOnlineBusiness(
            data: core.CreateOnlineBusinessData
        ): core.RepositoryEditResult<core.OnlineBusiness> {
            businessIdCounter += 1

            const business: core.OnlineBusiness = {
                id: businessIdCounter.toString(),
                name: data.name,
                website: data.website,
                email: data.email,
                total_reviews: 0,
                avg_rating: 0,
                latest_reviews: [],
            }
            businesses.push({ type: 'online', value: business })

            return { type: 'success', value: business }
        },

        async createPhysicalBusiness(
            data: core.CreatePhysicalBusinessData
        ): core.RepositoryEditResult<core.PhysicalBusiness> {
            businessIdCounter += 1

            const business: core.PhysicalBusiness = {
                id: businessIdCounter.toString(),
                name: data.name,
                address: data.address,
                phone: data.phone,
                email: data.email,
                total_reviews: 0,
                avg_rating: 0,
                latest_reviews: [],
            }
            businesses.push({ type: 'physical', value: business })

            return { type: 'success', value: business }
        },

        async getBusiness(
            id: core.BusinessId
        ): core.RepositoryFetchResult<core.Business> {
            const inMemBusiness = businesses.find((b) => b.value.id === id)
            if (!inMemBusiness) return { type: 'record_not_found' }

            // sort inMemBusiness.latest_reviews by date
            let sorted = inMemBusiness.value.latest_reviews.sort(
                (prev, next) => {
                    const prevTime = prev.creation_date.getTime()
                    const nextTime = next.creation_date.getTime()
                    return nextTime - prevTime
                }
            )

            // get the latest 3
            sorted = sorted.slice(0, 3)

            const business = {
                ...inMemBusiness,
                latest_reviews: sorted,
            }

            return { type: 'success', value: business }
        },
        async createReview(
            businessId: core.BusinessId,
            data: core.CreateReviewData
        ): core.RepositoryEditResult<core.Review> {
            const business = businesses.find((b) => b.value.id === businessId)
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

            business.value.total_reviews += 1
            business.value.latest_reviews.push(newReview)

            const ratingsSum = business.value.latest_reviews.reduce(
                (prev, curr) => prev + curr.rating,
                0
            )

            const totalReviews = business.value.latest_reviews.length
            let avg_rating = 0
            if (totalReviews !== 0) {
                avg_rating = ratingsSum / totalReviews
                avg_rating = Math.floor(avg_rating * 10) / 10
            }

            business.value.avg_rating = avg_rating

            return { type: 'success', value: newReview }
        },
    }
}
