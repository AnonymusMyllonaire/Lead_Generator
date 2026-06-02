import { useState } from 'react'
import SearchForm from './components/SearchForm'
import StatsCards from './components/StatsCards'
import ResultsTable from './components/ResultsTable'

export default function App() {
  const [leads, setLeads] = useState([])
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchParams, setSearchParams] = useState(null)

  const API_BASE = import.meta.env.VITE_API_URL || ''

  const handleSearch = async ({ city, country, minScore }) => {
    setIsLoading(true)
    setError(null)
    setLeads([])
    setStats(null)
    setSearchParams({ city, country, minScore })

    try {
      const res = await fetch(`${API_BASE}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, country, min_score: minScore }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to fetch leads')
      }
      const data = await res.json()
      setLeads(data.leads)
      setStats(data.stats)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">Lead Generator</h1>
            <p className="text-xs text-gray-400">Offline Clinic Discovery via OpenStreetMap</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <SearchForm onSearch={handleSearch} isLoading={isLoading} />

        {isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-14 flex flex-col items-center gap-5">
            <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-gray-800 font-medium">Searching for offline clinics…</p>
              <p className="text-sm text-gray-400 mt-1">This can take up to 60 seconds</p>
              {searchParams && (
                <p className="text-sm text-emerald-600 mt-1 font-medium">
                  {searchParams.city}, {searchParams.country}
                </p>
              )}
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-red-800">Search failed</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && leads.length > 0 && stats && (
          <>
            <StatsCards
              total={leads.length}
              stats={stats}
              city={searchParams?.city}
              country={searchParams?.country}
            />
            <ResultsTable
              leads={leads}
              city={searchParams?.city}
              country={searchParams?.country}
            />
          </>
        )}

        {!isLoading && !error && stats !== null && leads.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
            <p className="text-gray-500 font-medium">No offline clinics found</p>
            <p className="text-sm text-gray-400 mt-1">
              Try a different city or lower the minimum score.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
