import { PREFECTURE_COORDS } from './constants'

export type HotelSearchParams = {
  checkinDate: string
  checkoutDate: string
  adultNum?: number
  maxCharge?: number
  mealClass?: number
  keyword?: string
  prefectures?: string[]
  squeezeCondition?: string
  sort?: string
  hits?: number
}

export type Hotel = {
  name: string
  address: string
  minCharge: number
  special: string
  url: string
  planListUrl: string
  reviewAverage: number
  reviewCount: number
}

export async function searchHotels(params: HotelSearchParams, applicationId: string, accessKey: string): Promise<Hotel[]> {
  const prefectures = params.prefectures ?? ['岐阜']
  const hitsPerPref = Math.max(1, Math.floor((params.hits ?? 5) / prefectures.length))

  const results = await Promise.all(
    prefectures.map(pref => {
      const coords = PREFECTURE_COORDS[pref]
      if (!coords) return Promise.resolve([])
      return fetchHotels({ ...params, hits: hitsPerPref }, coords, applicationId, accessKey)
    })
  )

  return results.flat()
}

async function fetchHotels(
  params: HotelSearchParams,
  coords: { lat: number; lng: number },
  applicationId: string,
  accessKey: string,
): Promise<Hotel[]> {
  const query = new URLSearchParams({
    applicationId,
    accessKey,
    format: 'json',
    hits: String(params.hits ?? 5),
    checkinDate: params.checkinDate,
    checkoutDate: params.checkoutDate,
    latitude: String(coords.lat),
    longitude: String(coords.lng),
    searchRadius: '3',
    datumType: '1',
  })

  if (params.adultNum) query.set('adultNum', String(params.adultNum))
  if (params.maxCharge) query.set('maxCharge', String(params.maxCharge))
  if (params.mealClass) query.set('mealClass', String(params.mealClass))
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.squeezeCondition) query.set('squeezeCondition', params.squeezeCondition)
  if (params.sort) query.set('sort', params.sort)

  const response = await fetch(
    `https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426?${query}`,
    {
      headers: {
        'Referer': 'https://ai-secretary.rekishi-talk.workers.dev/',
        'Origin': 'https://ai-secretary.rekishi-talk.workers.dev',
      }
    }
  )
  const data = await response.json() as any

  if (!data.hotels) return []

  return data.hotels.map((h: any) => {
    const info = h.hotel[0].hotelBasicInfo
    return {
      name: info.hotelName,
      address: `${info.address1}${info.address2}`,
      minCharge: info.hotelMinCharge,
      special: info.hotelSpecial,
      url: info.hotelInformationUrl,
      planListUrl: info.planListUrl,
      reviewAverage: info.reviewAverage,
      reviewCount: info.reviewCount,
    }
  })
}
