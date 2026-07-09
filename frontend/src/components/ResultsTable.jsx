import { useState, useMemo } from 'react'

const COLUMNS = [
  { key: 'Lead Tier', label: 'Tier' },
  { key: 'Clinic Name', label: 'Clinic Name' },
  { key: 'Phone', label: 'Phone' },
  { key: 'Email', label: 'Email' },
  { key: 'Address', label: 'Address' },
  { key: 'City', label: 'City' },
  { key: 'Clinic Category', label: 'Category' },
  { key: 'Offline Score', label: 'Score' },
]

const TIER_BADGE = {
  A: 'bg-emerald-100 text-emerald-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-red-100 text-red-800',
}

const SCORE_BAR = (score) => {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-yellow-400'
  return 'bg-red-400'
}

const PAGE_SIZE = 25

function downloadCSV(rows, city) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads_${(city || 'export').toLowerCase().replace(/\s+/g, '_')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ResultsTable({ leads, city, subscribed = true }) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [tierFilter, setTierFilter] = useState('All')
  const [sortKey, setSortKey] = useState('Offline Score')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  const categories = useMemo(() => {
    const cats = [...new Set(leads.map(l => l['Clinic Category']))]
    return ['All', ...cats.sort()]
  }, [leads])

  const filtered = useMemo(() => {
    let rows = leads
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        ['Clinic Name', 'Phone', 'Email', 'Address', 'City', 'Clinic Category']
          .some(k => String(r[k] || '').toLowerCase().includes(q))
      )
    }
    if (categoryFilter !== 'All') rows = rows.filter(r => r['Clinic Category'] === categoryFilter)
    if (tierFilter !== 'All') rows = rows.filter(r => r['Lead Tier'] === tierFilter)
    return rows
  }, [leads, search, categoryFilter, tierFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
  }

  const resetFilters = () => {
    setSearch(''); setCategoryFilter('All'); setTierFilter('All'); setPage(1)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search name, phone, address…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
          ))}
        </select>

        {/* Tier filter */}
        <select
          value={tierFilter}
          onChange={e => { setTierFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {['All', 'A', 'B', 'C', 'D'].map(t => (
            <option key={t} value={t}>{t === 'All' ? 'All Tiers' : `Tier ${t}`}</option>
          ))}
        </select>

        {(search || categoryFilter !== 'All' || tierFilter !== 'All') && (
          <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-gray-700 underline">
            Reset
          </button>
        )}

        <span className="text-sm text-gray-400 ml-auto">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>

        {/* CSV download */}
        <button
          onClick={() => subscribed && downloadCSV(sorted, city)}
          disabled={!subscribed}
          title={subscribed ? undefined : 'Subscribe to unlock full results before downloading'}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm
            font-medium rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500
                    uppercase tracking-wide cursor-pointer select-none hover:bg-gray-100
                    whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-emerald-500 font-bold">
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No results match your filters.
                </td>
              </tr>
            ) : paginated.map((lead, i) => (
              <tr
                key={`${lead['OSM Type']}-${lead['OSM ID']}-${i}`}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Tier badge */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center justify-center w-7 h-7
                    rounded-full text-xs font-bold
                    ${TIER_BADGE[lead['Lead Tier']] || 'bg-gray-100 text-gray-600'}`}>
                    {lead['Lead Tier']}
                  </span>
                </td>

                {/* Clinic Name */}
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[220px]">
                  <span title={lead['Clinic Name']} className="block truncate">
                    {lead['Clinic Name']}
                  </span>
                </td>

                {/* Phone */}
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {lead['Phone'] ? (
                    <a href={`tel:${lead['Phone'].split(' | ')[0]}`}
                      className="hover:text-emerald-600 transition-colors">
                      {lead['Phone']}
                    </a>
                  ) : <span className="text-gray-300">—</span>}
                </td>

                {/* Email */}
                <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                  {lead['Email'] ? (
                    <a href={`mailto:${lead['Email'].split(' | ')[0]}`}
                      className="block truncate hover:text-emerald-600 transition-colors"
                      title={lead['Email']}>
                      {lead['Email']}
                    </a>
                  ) : <span className="text-gray-300">—</span>}
                </td>

                {/* Address */}
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px]">
                  <span title={lead['Address']} className="block truncate">
                    {lead['Address'] || <span className="text-gray-300">—</span>}
                  </span>
                </td>

                {/* City */}
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {lead['City'] || <span className="text-gray-300">—</span>}
                </td>

                {/* Category */}
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                  {lead['Clinic Category']}
                </td>

                {/* Score */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-14 bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${SCORE_BAR(lead['Offline Score'])}`}
                        style={{ width: `${lead['Offline Score']}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-6">
                      {lead['Offline Score']}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <p>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex gap-1">
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</PagBtn>
            {getPageNums(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-gray-300">…</span>
              ) : (
                <PagBtn key={p} onClick={() => setPage(p)} active={page === p}>{p}</PagBtn>
              )
            )}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</PagBtn>
          </div>
        </div>
      )}
    </div>
  )
}

function PagBtn({ onClick, disabled, active, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors
        ${active
          ? 'bg-emerald-600 text-white border-emerald-600'
          : 'border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default'
        }`}
    >
      {children}
    </button>
  )
}

function getPageNums(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = []
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '…', total)
  } else if (current >= total - 3) {
    pages.push(1, '…', total - 4, total - 3, total - 2, total - 1, total)
  } else {
    pages.push(1, '…', current - 1, current, current + 1, '…', total)
  }
  return pages
}
