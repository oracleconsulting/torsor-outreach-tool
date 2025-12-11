// Apollo.io enrichment types

export interface ApolloEnrichmentRequest {
  operation: 'find' | 'confirm'
  companyName: string
  companyNumber?: string
  domain?: string
  directorName?: string
  addressToConfirm?: {
    line1: string
    postcode: string
  }
  includeContacts?: boolean
}

export interface ApolloAddress {
  line1: string
  line2?: string
  city: string
  county?: string
  postcode: string
  country: string
}

export interface ApolloCompany {
  apolloId: string
  website: string | null
  phone: string | null
  industry: string | null
  employeeCount: number | null
  linkedIn: string | null
}

export interface ApolloContact {
  name: string
  title: string
  email: string | null
  emailVerified: boolean
  phone: string | null
  linkedIn: string | null
}

export interface ApolloEnrichmentResult {
  success: boolean
  found: boolean
  source: 'apollo'
  operation: 'find' | 'confirm'
  address?: ApolloAddress
  company?: ApolloCompany
  contacts?: ApolloContact[]
  confirmed?: boolean
  apolloAddress?: ApolloAddress
  confidence: number
  notes?: string
}

export interface ApolloPeopleEnrichmentRequest {
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  organizationName?: string
  domain?: string
  linkedinUrl?: string
  revealPersonalEmails?: boolean
  revealPhoneNumber?: boolean
}

export interface ApolloPersonAddress {
  line1: string
  line2?: string | null
  city: string
  county?: string
  postcode: string
  country: string
}

export interface ApolloPersonEmail {
  email: string
  type: 'work' | 'personal'
  verified: boolean
}

export interface ApolloPersonPhone {
  number: string
  type: string
  source?: string
}

export interface ApolloPerson {
  apolloId: string
  firstName: string
  lastName: string
  fullName: string
  title: string | null
  organizationName: string | null
  organizationDomain: string | null
  linkedinUrl: string | null
  address: ApolloPersonAddress | null
  emails: ApolloPersonEmail[]
  phoneNumbers: ApolloPersonPhone[]
  verifiedEmail: string | null
  primaryPhone: string | null
}

export interface ApolloPeopleEnrichmentResult {
  success: boolean
  found: boolean
  source: 'apollo'
  person?: ApolloPerson
  confidence: number
  notes?: string
  requiresUpgrade?: boolean
}

