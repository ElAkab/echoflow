/**
 * DASHBOARD PAGE - Protected Route
 * Route: /dashboard
 */

import { getUser, getUserProfile, signOut } from '@/lib/auth/actions'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  const profile = await getUserProfile()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Brain Loop
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Quota Display */}
            {profile && (
              <div className="px-4 py-2 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-600">
                  ⚡ {profile.hint_credits}/3 hints used
                </span>
              </div>
            )}
            
            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-gray-500">
                  {profile?.subscription_tier || 'FREE'} Plan
                </p>
              </div>
              
              <form action={signOut}>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome back, {user.email?.split('@')[0]}! 👋</h2>
            <p className="text-gray-600">
              Ready to boost your learning today?
            </p>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">📝</span>
                <span className="text-xs text-gray-500">Total</span>
              </div>
              <p className="text-3xl font-bold mb-1">0</p>
              <p className="text-sm text-gray-600">Notes created</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">📚</span>
                <span className="text-xs text-gray-500">Total</span>
              </div>
              <p className="text-3xl font-bold mb-1">0</p>
              <p className="text-sm text-gray-600">Categories</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">⚡</span>
                <span className="text-xs text-gray-500">This week</span>
              </div>
              <p className="text-3xl font-bold mb-1">{3 - (profile?.hint_credits || 0)}</p>
              <p className="text-sm text-gray-600">Hints remaining</p>
            </div>
          </div>
          
          {/* Getting Started */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">🚀 Get Started</h3>
            <p className="text-gray-600 mb-6">
              Create your first category to start organizing your notes
            </p>
            <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-lg">
              Create First Category
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
