import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useNavigate } from '@tanstack/react-router'
import { Building2, Loader2 } from 'lucide-react'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      if (data.user) {
        // Check if user is a practice member
        const { data: memberData, error: memberError } = await supabase
          .from('practice_members')
          .select('practice_id')
          .eq('user_id', data.user.id)
          .single()

        if (memberError || !memberData) {
          await supabase.auth.signOut()
          const errorMsg = 'You do not have access to this application. Please contact your administrator.'
          setError(errorMsg)
          toast.error(errorMsg)
          return
        }

        // Redirect to dashboard
        toast.success('Signed in successfully!')
        navigate({ to: '/' })
      }
    } catch (err: any) {
      console.error('Login error:', err)
      // Provide more helpful error messages
      let errorMsg = 'Failed to sign in. Please check your credentials.'
      if (err.message?.includes('Invalid login credentials')) {
        errorMsg = 'Invalid email or password. If you\'ve forgotten your password, please contact your administrator to reset it.'
      } else if (err.message) {
        errorMsg = err.message
      }
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">Torsor Outreach</h1>
            </div>
            <p className="text-gray-600">Sign in to access the Companies House mining tool</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>
              Need access? Contact your practice administrator or visit{' '}
              <a href="https://torsor.co.uk" className="text-primary hover:underline">
                torsor.co.uk
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

