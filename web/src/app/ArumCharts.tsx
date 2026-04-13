'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, Line, ComposedChart,
} from 'recharts';

/* ─── Exported types (consumed by page.tsx server component) ─── */

export interface ArumMonthlyStat {
  month: string;
  count: number;
}

export interface OutlookStat {
  outlook: string;      // "Positive" | "Neutral" | "Negative"
  count: number;
  avgPeak: number | null;
  avgReturn: number | null;
  winRate: number;
}

export interface TargetBucket {
  range: string;
  count: number;
}

export interface ArumAgeStat {
  age: string;
  count: number;
  avgCurrent: number;
  winRate: number;
}

/* ─── Props ─── */

interface Props {
  monthly: ArumMonthlyStat[];
  outlookStats: OutlookStat[];
  targetAchieveBuckets: TargetBucket[];
  targetUpsideBuckets: TargetBucket[];
  peakBuckets: TargetBucket[];
  ageGroups: ArumAgeStat[];
}

/* ─── Helpers ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SimpleTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.value}건
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PctTooltip({ active, payload, label }: any) {
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

/** 건수(정수)와 %(소수) 혼합 툴팁 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MixedTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => {
        const isCount = p.name === '건수';
        const fmt = isCount
          ? `${p.value}건`
          : `${p.value > 0 ? '+' : ''}${p.value.toFixed(1)}%`;
        return (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {fmt}
          </p>
        );
      })}
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

export default function ArumCharts({
  monthly,
  outlookStats,
  targetAchieveBuckets,
  targetUpsideBuckets,
  peakBuckets,
  ageGroups,
}: Props) {
  const OUTLOOK_COLORS: Record<string, string> = {
    'Positive': '#10b981',
    'Neutral':  '#eab308',
    'Negative': '#ef4444',
  };

  const TARGET_ACHIEVE_COLORS: Record<string, string> = {
    '25% 미만':   '#ef4444',
    '25~50%':    '#f97316',
    '50~75%':    '#eab308',
    '75~100%':   '#84cc16',
    '100~150%':  '#10b981',
    '150%+':     '#14b8a6',
  };

  const TARGET_UPSIDE_COLORS: Record<string, string> = {
    '-20%+ 초과': '#7f1d1d',
    '-20~0%':    '#ef4444',
    '0~20%':     '#86efac',
    '20~50%':    '#10b981',
    '50~100%':   '#059669',
    '100%+':     '#047857',
  };

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h2 className="text-lg font-bold text-white">인사이트 대시보드</h2>
        <p className="text-xs text-gray-500 mt-1">
          애널리스트&nbsp;
          <strong className="text-gray-400">전망 정확도</strong>,&nbsp;
          <strong className="text-gray-400">목표가 분석</strong>,&nbsp;
          <strong className="text-gray-400">시장 반응</strong>을 분석합니다
        </p>
      </div>

      {/* ── 섹션 1: 애널리스트 전망 분석 ── */}
      <SectionHeader
        title="① 애널리스트 전망 분석"
        subtitle="전망 라벨이 실제 수익률과 얼마나 일치하는가"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <ChartCard
          title="전망별 수익률 비교"
          intent="전망 라벨이 실제 수익률과 얼마나 일치하는지 확인합니다. 승률 = 현재 수익률 > 0인 종목 비율."
          badge={{ label: '전망 정확도', color: 'bg-emerald-900 text-emerald-300' }}
        >
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={outlookStats} margin={{ top: 4, right: 40, left: -4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="outlook" tick={{ fontSize: 11, fill: '#6b7280' }} />
              {/* left: % 축 (수익률 + 승률) */}
              <YAxis yAxisId="pct" tick={{ fontSize: 9, fill: '#6b7280' }}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`} />
              {/* right: 건수 축 (정수) */}
              <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 9, fill: '#6b7280' }}
                allowDecimals={false} />
              <Tooltip content={<MixedTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} iconSize={8} />
              {/* 건수 → right 축 */}
              <Bar yAxisId="cnt" dataKey="count" name="건수" radius={[2, 2, 0, 0]} opacity={0.5}>
                {outlookStats.map((entry, i) => (
                  <Cell key={i} fill={OUTLOOK_COLORS[entry.outlook] ?? '#6b7280'} />
                ))}
              </Bar>
              {/* 수익률 + 승률 → left % 축 */}
              <Line yAxisId="pct" type="monotone" dataKey="avgReturn" name="평균 수익률"
                stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
              <Line yAxisId="pct" type="monotone" dataKey="winRate" name="승률"
                stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="전망별 최고 상승률 vs 현재 수익률"
          intent="전망 라벨별 최대 상승 잠재력(최고 상승률)과 현재 남아있는 수익률을 비교합니다."
          badge={{ label: '전망별 성과', color: 'bg-blue-900 text-blue-300' }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={outlookStats} margin={{ top: 0, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="outlook" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`} />
              <Tooltip content={<PctTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} iconSize={8} />
              <Bar dataKey="avgPeak" name="최고 상승률" fill="#374151" radius={[2, 2, 0, 0]} />
              <Bar dataKey="avgReturn" name="현재 수익률" radius={[2, 2, 0, 0]}>
                {outlookStats.map((entry, i) => (
                  <Cell key={i} fill={(entry.avgReturn ?? 0) >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── 섹션 2: 목표가 분석 ── */}
      <SectionHeader
        title="② 목표가 분석"
        subtitle="애널리스트가 제시한 적정주가 대비 현재 주가 위치"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <ChartCard
          title="목표가 달성률 분포"
          intent="현재 주가가 애널리스트가 제시한 적정주가의 몇 %에 도달했는지 보여줍니다. 100% 이상은 목표가 초과 달성 종목입니다."
          badge={{ label: '목표가 달성', color: 'bg-teal-900 text-teal-300' }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={targetAchieveBuckets} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip content={<SimpleTooltip />} />
              <Bar dataKey="count" name="종목 수" radius={[2, 2, 0, 0]}>
                {targetAchieveBuckets.map((entry, i) => (
                  <Cell key={i} fill={TARGET_ACHIEVE_COLORS[entry.range] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="목표가 상향 여력 분포"
          intent="(목표가 - 현재가) / 현재가 × 100%. 음수는 이미 목표가를 넘은 종목, 양수는 아직 여력이 남은 종목입니다."
          badge={{ label: '상향 여력', color: 'bg-purple-900 text-purple-300' }}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={targetUpsideBuckets} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip content={<SimpleTooltip />} />
              <Bar dataKey="count" name="종목 수" radius={[2, 2, 0, 0]}>
                {targetUpsideBuckets.map((entry, i) => (
                  <Cell key={i} fill={TARGET_UPSIDE_COLORS[entry.range] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── 섹션 3: 발간 후 시장 반응 ── */}
      <SectionHeader
        title="③ 발간 후 시장 반응"
        subtitle="리포트 발간 후 주가가 어떻게 움직였는가"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <ChartCard
          title="최고 상승률 분포"
          intent="리포트 발간 후 한 번이라도 얼마나 올랐는지 보여줍니다."
          badge={{ label: '반응 강도', color: 'bg-emerald-900 text-emerald-300' }}
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
          title="경과 기간별 평균 수익률"
          intent="리포트 발간 후 얼마나 지난 종목이 현재 어떤 수익률을 보이는지 확인합니다."
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
                stroke="#eab308" strokeWidth={2} dot={{ fill: '#eab308', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── 섹션 4: 리서치알음 동향 ── */}
      <SectionHeader
        title="④ 리서치알음 동향"
        subtitle="리포트 발간 추이"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <ChartCard
          title="월별 발간 추이"
          intent="리서치알음의 리포트 발간 추이를 보여줍니다."
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="month"
                tickFormatter={(m: string) => m.slice(2)}
                tick={{ fontSize: 9, fill: '#6b7280' }}
                interval={0}
              />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip content={<SimpleTooltip />} />
              <Bar dataKey="count" name="건수" fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </div>
  );
}
