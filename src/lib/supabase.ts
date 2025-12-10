import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create client with default schema set to 'outreach' for outreach schema tables
// For tables in other schemas, we'll need to create separate clients or use RPC
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to get a client scoped to a specific schema
export function getSchemaClient(schema: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    db: {
      schema: schema,
    },
  })
}

