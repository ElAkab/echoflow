'use client'

import { signInWithGoogle, signInWithEmail } from '@/lib/auth/actions'
import { useState } from 'react'

export default function LoginPage() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    await signInWithGoogle()
  }

  async function handleEmailSignIn(formData: FormData) {
    setLoading(true)
    const result = await signInWithEmail(formData)
    
    if (result.error) {
      setMessage(result.error)
    } else {
      setMessage(result.message || 'Check your email!')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to continue learning</p>
        </div>
        
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.includes('error') || message.includes('Error')
              ? 'bg-red-50 text-red-600'
              : 'bg-green-50 text-green-600'
          }`}>
            {message}
          </div>
        )}
        
        <div className="space-y-4">
          <form action={handleGoogleSignIn}>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition flex items-center justify-center gap-3 font-medium disabled:opacity-50"
            >
              <span>🔍</span>
              <span>Continue with Google</span>
            </button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or with email</span>
            </div>
          </div>
          
          <form action={handleEmailSignIn} className="space-y-4">
            <input
              type="email"
              name="email"
              required
              placeholder="your@email.com"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-8">
          New to Brain Loop?{" "}
          <span className="text-blue-600 font-medium">
            Just sign in - we'll create your account automatically!
          </span>
        </p>
      </div>
    </div>
  );
}
