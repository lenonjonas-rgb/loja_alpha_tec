export type StoreReview = {
  id: string
  rating: number
  comment: string
  photos: string[]
  createdAt: string
  customerName: string
}

export type StoreReviewsResponse = {
  total: number
  reviews: StoreReview[]
}
