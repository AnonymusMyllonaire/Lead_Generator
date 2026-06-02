import { useState } from 'react'

const PAKISTAN_CITIES = [
  'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad',
  'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala',
  'Hyderabad', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Larkana',
]

export default function SearchForm({ onSearch, isLoading }) {
  const [city, setCity] = useState('Lahore')
  const [country, setCountry] = useState('Pakistan')
  const [minScore, setMinScore] = useState(0)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSearch({ city: city.trim(), country: country.trim(), minScore: Number(minScore) })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Search Parameters</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">

        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">City</label>
          <input
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="e.g. Lahore"
            list="city-suggestions"
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <datalist id="city-suggestions">
            {PAKISTAN_CITIES.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Country</label>
          <input
            type="text"
            value={country}
            onChange={e => setCountry(e.target.value)}
            placeholder="e.g. Pakistan"
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div className="w-52">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Min Score&nbsp;
            <span className="text-emerald-600 font-bold">{minScore}</span>
            <span className="text-gray-400 font-normal"> / 100</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-300 mt-0.5">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg
            hover:bg-emerald-700 active:bg-emerald-800
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors whitespace-nowrap"
        >
          {isLoading ? 'Searching…' : 'Generate Leads'}
        </button>
      </form>
    </div>
  )
}
