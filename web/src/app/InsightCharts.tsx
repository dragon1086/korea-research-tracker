'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, LineChart, Line, ComposedChart,
} from 'recharts';

/* ─── Exported types (consumed by page.tsx server component) ─── */

export interface MonthlyCount {
  month: string;
  count: number;
}

export interface ThemeStat {
  theme: string;
  count: number;
  avgReturn: number | null;
}

export interface ThemePumpStat {
  theme: string;
  count: number;
  avgPeak: number | null;
  avgReturn: number | null;
}

export interface ReturnBucket {
  range: string;
  count: number;
}

export interface YearlyStat {
  year: string;
  count: number;
  avgPeak: number;       // 중앙값
  avgPeakMean: number;   // 평균값 (툴팁용)
  maxPeak: number;
  avgCurrent: number;
  winRate: number;
}

export interface AgeStat {
  age: string;
  count: number;
  avgCurrent: number;
  winRate: number;
}

/* ─── Props ─── */

interface Props {
  monthly: MonthlyCount[];
  peakBuckets: ReturnBucket[];
  daysToPeak: ReturnBucket[];
  retentionBuckets: ReturnBucket[];
  themePumpVsCurrent: ThemePumpStat[];
  yearlyStats: YearlyStat[];
  ageGroups: AgeStat[];
  peakTrapBuckets: ReturnBucket[];
}

/* ─── Helpers ─── */

const formatMonth = (m: string) => m.slice(2);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SimpleTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.value}{p.name.includes('승률') ? '%' : '건'}
        </p>
      ))}
    </div>
  );
}

function PctTooltip({ active, payload, label }: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number'
            ? `${p.value > 0 ? '+' : ''}${p.value.toFixed(1)}%`
            : p.value}
        </p>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  intent,
  badge,
  children,
}: {
  title: string;
  intent: string;
  badge?: { label: string; color: string };
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
            {badge.label}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">{intent}</p>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mt-2 mb-1">
      <h3 className="text-base font-bold text-gray-100">{title}</h3>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

/* ─── Main component ─── */

export default function InsightCharts({
  monthly,
  peakBuckets,
  daysToPeak,
  retentionBuckets,
  themePumpVsCurrent,
  yearlyStats,
  ageGroups,
  peakTrapBuckets,
}: Props) {
  const RETENTION_COLORS: Record<string, string> = {
    '음전환':              '#ef4444',
    '0~25%':              '#f97316',
    '25~50%':             '#eab308',
    '50~75%':             '#84cc16',
    '75~100% (최고점)':    '#10b981',
  };

  const PEAK_TRAP_COLORS: Record<string, string> = {
    '0% (고점 유지)': '#10b981',
    '-5~-20%':       '#84cc16',
    '-20~-40%':      '#eab308',
    '-40~-60%':      '#f97316',
    '-60~-80%':      '#ef4444',
    '-80%~':         '#7f1d1d',
  };

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h2 className="text-lg font-bold text-white">인사이트 대시보드</h2>
        <p className="text-xs text-gray-500 mt-1">
          리포트의 <strong className="text-gray-400">단기 부양 효과</strong>,&nbsp;
          <strong className="text-gray-400">효력 지속성</strong>,&nbsp;
          <strong className="text-gray-400">투자 활용 가이드</strong>를 분석합니다
        </p>
      </div>

      {/* ── 섹션 1: 단기 부양 효과 ── */}
      <SectionHeader
        title="① 단기 부양 효과"
        subtitle="리포트가 나온 직후 주가에 어떤 영향을 줬는가"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <ChartCard
          title="리포트 직후 최대 상승률 분포"
          intent="현재 수익률이 아닌 '한 번이라도 얼마나 올랐나(peak_pct)'를 측정합니다. 리포트 발간이 만들어낸 단기 부양 강도를 보여줍니다."
          badge={{ label: '부양 강도', color: 'bg-emerald-900 text-emerald-300' }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={peakBuckets} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip content={<SimpleTooltip />} />
              <Bar dataKey="count" name="종목 수" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="최고점 도달 기간 분포"
          intent="리포트 발간일부터 최고가까지 걸린 일수입니다. 당일~3일(노란색) 비중이 높으면 리포트 공개 직후 집중 매수세, 즉 의도된 단기 부양 패턴입니다."
          badge={{ label: '부양 속도', color: 'bg-yellow-900 text-yellow-300' }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daysToPeak} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip content={<SimpleTooltip />} />
              <Bar dataKey="count" name="종목 수" radius={[2, 2, 0, 0]}>
                {daysToPeak.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={['당일', '1~3일', '4~7일'].includes(entry.range) ? '#f59e0b' : '#374151'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── 섹션 2: 부양 효과 지속성 ── */}
      <SectionHeader
        title="② 부양 효과 지속성"
        subtitle="상승한 주가가 지금도 유지되고 있는가, 소멸했는가"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <ChartCard
          title="부양 효과 잔존율"
          intent="현재 수익률 ÷ 최대 수익률로 계산합니다. '음전환'은 고점 달성 후 리포트 기준가 이하로 반락한 종목, '100%+'는 아직 최고점을 갱신 중인 종목입니다."
          badge={{ label: '소멸 분석', color: 'bg-purple-900 text-purple-300' }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={retentionBuckets} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip content={<SimpleTooltip />} />
              <Bar dataKey="count" name="종목 수" radius={[2, 2, 0, 0]}>
                {retentionBuckets.map((entry, i) => (
                  <Cell key={i} fill={RETENTION_COLORS[entry.range] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="고점 추종 시 현재 손실 분포"
          intent="리포트 후 최고점에서 매수했다면 현재 얼마나 잃었는지 보여줍니다(현재 수익률 − 최대 수익률). 부양 이후 주가를 쫓아 매수하는 행위의 위험성을 경고합니다."
          badge={{ label: '⚠ 고점 추종 경고', color: 'bg-red-900 text-red-300' }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={peakTrapBuckets} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip content={<SimpleTooltip />} />
              <Bar dataKey="count" name="종목 수" radius={[2, 2, 0, 0]}>
                {peakTrapBuckets.map((entry, i) => (
                  <Cell key={i} fill={PEAK_TRAP_COLORS[entry.range] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── 섹션 3: 투자 활용 가이드 ── */}
      <SectionHeader
        title="③ 투자 활용 가이드"
        subtitle="언제 어떤 리포트를 어떻게 활용할 것인가"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <ChartCard
          title="리포트 경과 기간별 현재 수익률"
          intent="리포트가 발간된 지 얼마나 됐는지에 따라 현재 수익률이 어떻게 달라지는지 보여줍니다. 리포트 효력이 언제까지 유효한지 판단하는 기준이 됩니다."
          badge={{ label: '매수 타이밍', color: 'bg-blue-900 text-blue-300' }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={ageGroups} margin={{ top: 0, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="age" tick={{ fontSize: 9, fill: '#6b7280' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#6b7280' }}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#6b7280' }}
                tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
              <Tooltip content={<PctTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} iconSize={8} />
              <Bar yAxisId="left" dataKey="avgCurrent" name="평균 수익률" radius={[2, 2, 0, 0]}>
                {ageGroups.map((entry, i) => (
                  <Cell key={i} fill={entry.avgCurrent >= 0 ? '#6366f1' : '#ef4444'} />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="winRate" name="승률(%)"
                stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="연도별 부양 강도 vs 현재 수익률"
          intent="연도별 최대 부양률(중앙값, 회색)과 현재 수익률을 비교합니다. 평균은 4000%+ 극단값에 왜곡되므로 중앙값을 사용합니다. 툴팁에서 평균·최대값도 확인할 수 있습니다."
          badge={{ label: '빈티지 분석', color: 'bg-indigo-900 text-indigo-300' }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={yearlyStats} margin={{ top: 0, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#6b7280' }}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#6b7280' }}
                tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as YearlyStat;
                return (
                  <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg space-y-0.5">
                    <p className="text-gray-400 font-semibold mb-1">{label}년</p>
                    <p className="text-gray-300">부양 중앙값: <span className="text-white font-mono">+{d.avgPeak}%</span></p>
                    <p className="text-gray-300">부양 평균: <span className="text-gray-400 font-mono">+{d.avgPeakMean}%</span></p>
                    <p className="text-gray-300">최대 부양: <span className="text-yellow-400 font-mono">+{d.maxPeak}%</span></p>
                    <p className="text-gray-300">현재 수익률: <span className={`font-mono ${d.avgCurrent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{d.avgCurrent >= 0 ? '+' : ''}{d.avgCurrent}%</span></p>
                    <p className="text-gray-300">승률: <span className="text-yellow-400 font-mono">{d.winRate}%</span></p>
                    <p className="text-gray-500">리포트 수: {d.count}건</p>
                  </div>
                );
              }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} iconSize={8} />
              <Bar yAxisId="left" dataKey="avgPeak" name="부양 중앙값" fill="#374151" radius={[2, 2, 0, 0]} />
              <Bar yAxisId="left" dataKey="avgCurrent" name="현재 수익률" radius={[2, 2, 0, 0]}>
                {yearlyStats.map((entry, i) => (
                  <Cell key={i} fill={entry.avgCurrent >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="winRate" name="승률(%)"
                stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── 섹션 4: 밸류파인더 동향 ── */}
      <SectionHeader
        title="④ 밸류파인더 동향"
        subtitle="어떤 기업을 얼마나 커버하고 있는가"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <ChartCard
          title="월별 리포트 발간 추이"
          intent="밸류파인더의 사업 확장 속도를 보여줍니다. 리포트 수 증가는 더 많은 고객사가 주가 부양 서비스를 이용하고 있다는 의미입니다."
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fontSize: 9, fill: '#6b7280' }}
                interval={5}
              />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip content={<SimpleTooltip />} />
              <Bar dataKey="count" name="건수" fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="테마별 부양 효과 vs 현재 수익률"
          intent="테마별 최대 수익률(회색)과 현재 수익률(색상)을 비교합니다. 격차가 크면 해당 테마의 부양 효과가 소멸한 것입니다. 테마는 리포트 제목 키워드 기반으로 실시간 분류됩니다."
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={themePumpVsCurrent}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 9, fill: '#6b7280' }}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
              />
              <YAxis
                dataKey="theme"
                type="category"
                tick={{ fontSize: 10, fill: '#d1d5db' }}
                width={75}
              />
              <Tooltip
                formatter={(v, name) => [
                  typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : v,
                  name,
                ]}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} iconSize={8} />
              <Bar dataKey="avgPeak" name="최대 부양" fill="#374151" radius={[0, 2, 2, 0]} />
              <Bar dataKey="avgReturn" name="현재 수익률" radius={[0, 2, 2, 0]}>
                {themePumpVsCurrent.map((entry, i) => (
                  <Cell key={i} fill={(entry.avgReturn ?? 0) >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </div>
  );
}
