const TIER_CONFIG = {
  A: {
    label: 'Tier A',
    desc: 'Score 80–100',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    num: 'text-emerald-800',
  },
  B: {
    label: 'Tier B',
    desc: 'Score 60–79',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
    num: 'text-blue-800',
  },
  C: {
    label: 'Tier C',
    desc: 'Score 40–59',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-600',
    num: 'text-yellow-800',
  },
  D: {
    label: 'Tier D',
    desc: 'Score 0–39',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    num: 'text-red-800',
  },
}

export default function StatsCards({ total, stats, city, country }) {
  const { tiers, categories } = stats

  return (
    <div className="space-y-4">
      {/* Total + tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        {/* Total */}
        <div className="sm:col-span-1 bg-white rounded-xl border border-gray-200 p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Leads</p>
          <p className="text-4xl font-bold text-gray-900 mt-2">{total}</p>
          <p className="text-xs text-gray-400 mt-1 truncate">{city}, {country}</p>
        </div>

        {/* Tier cards */}
        {Object.entries(TIER_CONFIG).map(([tier, cfg]) => (
          <div
            key={tier}
            className={`rounded-xl border p-5 flex flex-col justify-between ${cfg.bg} ${cfg.border}`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</p>
              <span className={`text-xs ${cfg.text} opacity-60`}>{cfg.desc}</span>
            </div>
            <p className={`text-3xl font-bold mt-2 ${cfg.num}`}>{tiers[tier] || 0}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {Object.keys(categories).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Category Breakdown
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categories)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <span className="text-sm font-medium text-gray-700">{cat}</span>
                  <span className="text-xs bg-gray-200 text-gray-600 font-medium rounded-full px-2 py-0.5">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
