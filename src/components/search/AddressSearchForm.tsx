import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { companiesHouse } from '../../services/companiesHouse'
import type { Company } from '../../types'

interface AddressSearchFormProps {
  onResults?: (results: Company[]) => void
  onLoading?: (loading: boolean) => void
}

export function AddressSearchForm({ onResults, onLoading }: AddressSearchFormProps) {
  const [searchType, setSearchType] = useState<'postcode' | 'address'>('postcode')
  const [postcode, setPostcode] = useState('')
  const [address, setAddress] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    onLoading?.(true)

    try {
      let results: Company[] = []

      if (searchType === 'postcode') {
        if (!postcode.trim()) return
        results = await companiesHouse.searchByPostcode(postcode.trim())
      } else {
        // For full address, we'll search by postcode extracted from address
        // This is a simplified approach - in production you might want to use a geocoding service
        const postcodeMatch = address.match(/[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}/i)
        if (postcodeMatch) {
          results = await companiesHouse.searchByPostcode(postcodeMatch[0])
        } else {
          alert('Please include a valid UK postcode in the address')
          setIsLoading(false)
          onLoading?.(false)
          return
        }
      }

      onResults?.(results)
    } catch (error: any) {
      console.error('Address search error:', error)
      alert('Error searching: ' + error.message)
    } finally {
      setIsLoading(false)
      onLoading?.(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex gap-4 mb-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="postcode"
              checked={searchType === 'postcode'}
              onChange={(e) => setSearchType(e.target.value as 'postcode')}
              className="mr-2"
            />
            Search by Postcode
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="address"
              checked={searchType === 'address'}
              onChange={(e) => setSearchType(e.target.value as 'address')}
              className="mr-2"
            />
            Search by Full Address
          </label>
        </div>

        {searchType === 'postcode' ? (
          <div>
            <label htmlFor="postcode" className="block text-sm font-medium text-gray-700 mb-1">
              Postcode
            </label>
            <input
              id="postcode"
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="e.g., SW1A 1AA"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Enter a UK postcode to find all companies registered at that location
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Full Address
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter full address including postcode, e.g., 10 Downing Street, London, SW1A 2AA"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={3}
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Enter a full UK address. A postcode will be extracted for the search.
            </p>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Search Companies
          </>
        )}
      </button>
    </form>
  )
}

