import { readFileSync } from 'fs';
import { join } from 'path';
import InsightCharts, { MonthlyCount, ThemeStat, ReturnBucket, ThemePumpStat, YearlyStat, AgeStat } from './InsightCharts';

interface Report {
  wr_id: number;
  company: string;
  ticker: string;
  title: string;
  author: string;
  report_date: string;
  url: string;
  price_on_date: number | null;
  latest_price: number | null;
  pct_change: number | null;
  peak_price: number | null;
  peak_date: string | null;
  peak_pct: number | null;
  trough_price: number | null;
  trough_date: string | null;
  trough_pct: number | null;
}

interface ReportsData {
  updated_at: string;
  reports: Report[];
}

function loadReports(): ReportsData {
  try {
    const filePath = join(process.cwd(), 'public', 'reports.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { updated_at: '', reports: [] };
  }
}

const THEMES: Record<string, string[]> = {
  'AI/반도체': ['AI', '반도체', '엔비디아', '인공지능', 'HBM', 'GPU', '데이터센터', '칩', '파운드리'],
  '2차전지/EV': ['2차전지', '배터리', 'EV', '전기차', '리튬', '양극재', '음극재', '전해질'],
  '바이오/헬스': ['바이오', '헬스', '제약', '의료', '치료', '신약', '진단', '임상', '의약'],
  '로봇': ['로봇', '자동화', '협동로봇', '스마트팩토리'],
  '방산': ['방산', '잠수함', '방위', 'K방산', '무기체계', '군'],
  '조선': ['조선', '선박', 'LNG', '해양'],
  '뷰티/소비재': ['뷰티', '화장품', 'ODM', '브랜드', '패션', '식품', '음료', '유통'],
  '엔터/게임': ['엔터', '콘텐츠', '게임', '미디어', 'IP', '웹툰', '드라마'],
  '소재/화학': ['화학', '소재', '섬유', '정밀화학', '고분자'],
};

function classifyTheme(title: string): string {
  for (const [theme, keywords] of Object.entries(THEMES)) {
    if (keywords.some(kw => title.includes(kw))) return theme;
  }
  return '기타';
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  // "2026.04.10" or "2026-04-10"
  const normalized = s.replace(/\./g, '-');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: string, to: string): number | null {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function computeMonthly(reports: Report[]): MonthlyCount[] {
  const map = new Map<string, number>();
  for (const r of reports) {
    const d = r.report_date;
    if (!d) continue;
    const [y, m] = d.split('.');
    if (!y || !m) continue;
    const key = `${y}-${m}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));
}

function computePeakBuckets(reports: Report[]): ReturnBucket[] {
  const buckets: [string, (v: number) => boolean][] = [
    ['+0~10%',   v => v >= 0  && v < 10],
    ['+10~30%',  v => v >= 10 && v < 30],
    ['+30~50%',  v => v >= 30 && v < 50],
    ['+50~100%', v => v >= 50 && v < 100],
    ['+100~200%',v => v >= 100 && v < 200],
    ['+200%~',   v => v >= 200],
  ];
  const counts = new Map(buckets.map(([label]) => [label, 0]));
  for (const r of reports) {
    if (r.peak_pct == null) continue;
    for (const [label, pred] of buckets) {
      if (pred(r.peak_pct)) { counts.set(label, (counts.get(label) ?? 0) + 1); break; }
    }
  }
  return buckets.map(([label]) => ({ range: label, count: counts.get(label) ?? 0 }));
}

function computeDaysToPeak(reports: Report[]): ReturnBucket[] {
  const buckets: [string, (v: number) => boolean][] = [
    ['당일',    v => v === 0],
    ['1~3일',   v => v >= 1  && v <= 3],
    ['4~7일',   v => v >= 4  && v <= 7],
    ['8~14일',  v => v >= 8  && v <= 14],
    ['15~30일', v => v >= 15 && v <= 30],
    ['31~90일', v => v >= 31 && v <= 90],
    ['90일+',   v => v > 90],
  ];
  const counts = new Map(buckets.map(([label]) => [label, 0]));
  for (const r of reports) {
    if (!r.peak_date || !r.report_date) continue;
    const days = daysBetween(r.report_date, r.peak_date);
    if (days == null || days < 0) continue;
    for (const [label, pred] of buckets) {
      if (pred(days)) { counts.set(label, (counts.get(label) ?? 0) + 1); break; }
    }
  }
  return buckets.map(([label]) => ({ range: label, count: counts.get(label) ?? 0 }));
}

function computeRetentionBuckets(reports: Report[]): ReturnBucket[] {
  // retentionRate = current pct_change / peak_pct * 100
  const buckets: [string, (v: number) => boolean][] = [
    ['음전환',          v => v < 0],
    ['0~25%',          v => v >= 0  && v < 25],
    ['25~50%',         v => v >= 25 && v < 50],
    ['50~75%',         v => v >= 50 && v < 75],
    ['75~100% (최고점)', v => v >= 75],
  ];
  const counts = new Map(buckets.map(([label]) => [label, 0]));
  for (const r of reports) {
    if (r.peak_pct == null || r.peak_pct === 0 || r.pct_change == null) continue;
    const retention = (r.pct_change / r.peak_pct) * 100;
    for (const [label, pred] of buckets) {
      if (pred(retention)) { counts.set(label, (counts.get(label) ?? 0) + 1); break; }
    }
  }
  return buckets.map(([label]) => ({ range: label, count: counts.get(label) ?? 0 }));
}

function computeThemePumpVsCurrent(reports: Report[]): ThemePumpStat[] {
  const map = new Map<string, { count: number; peaks: number[]; currents: number[] }>();
  for (const r of reports) {
    const theme = classifyTheme(r.title ?? '');
    if (!map.has(theme)) map.set(theme, { count: 0, peaks: [], currents: [] });
    const entry = map.get(theme)!;
    entry.count++;
    if (r.peak_pct != null) entry.peaks.push(r.peak_pct);
    if (r.pct_change != null) entry.currents.push(r.pct_change);
  }
  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
  return Array.from(map.entries())
    .map(([theme, { count, peaks, currents }]) => ({
      theme,
      count,
      avgPeak: avg(peaks),
      avgReturn: avg(currents),
    }))
    .filter(t => t.count >= 3)
    .sort((a, b) => b.count - a.count);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2 * 10) / 10
    : Math.round(sorted[mid] * 10) / 10;
}

function computeYearlyStats(reports: Report[]): YearlyStat[] {
  const map = new Map<string, { count: number; peaks: number[]; currents: number[] }>();
  for (const r of reports) {
    const d = r.report_date;
    if (!d) continue;
    const year = d.split('.')[0];
    if (!map.has(year)) map.set(year, { count: 0, peaks: [], currents: [] });
    const entry = map.get(year)!;
    entry.count++;
    if (r.peak_pct != null) entry.peaks.push(r.peak_pct);
    if (r.pct_change != null) entry.currents.push(r.pct_change);
  }
  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, { count, peaks, currents }]) => ({
      year,
      count,
      avgPeak: median(peaks),      // 중앙값 사용 — 극단값 왜곡 방지
      avgPeakMean: avg(peaks),     // 툴팁용 평균값
      maxPeak: peaks.length > 0 ? Math.round(Math.max(...peaks)) : 0,
      avgCurrent: avg(currents),
      winRate: currents.length > 0
        ? Math.round(currents.filter(c => c > 0).length / currents.length * 100)
        : 0,
    }));
}

function computeAgeGroups(reports: Report[]): AgeStat[] {
  const today = new Date();
  const AGE_BUCKETS: [string, (d: number) => boolean][] = [
    ['1개월 이내', d => d <= 30],
    ['1~3개월',    d => d > 30  && d <= 90],
    ['3~6개월',    d => d > 90  && d <= 180],
    ['6~12개월',   d => d > 180 && d <= 365],
    ['1~2년',      d => d > 365 && d <= 730],
    ['2년+',       d => d > 730],
  ];
  const groups = new Map(AGE_BUCKETS.map(([label]) => [label, [] as number[]]));
  for (const r of reports) {
    if (!r.report_date || r.pct_change == null) continue;
    const dt = parseDate(r.report_date);
    if (!dt) continue;
    const days = Math.round((today.getTime() - dt.getTime()) / 86400000);
    for (const [label, pred] of AGE_BUCKETS) {
      if (pred(days)) { groups.get(label)!.push(r.pct_change); break; }
    }
  }
  return AGE_BUCKETS
    .map(([label]) => {
      const vals = groups.get(label)!;
      return {
        age: label,
        count: vals.length,
        avgCurrent: vals.length > 0
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
          : 0,
        winRate: vals.length > 0
          ? Math.round(vals.filter(v => v > 0).length / vals.length * 100)
          : 0,
      };
    })
    .filter(g => g.count > 0);
}

function computePeakTrapBuckets(reports: Report[]): ReturnBucket[] {
  // 고점 가격 대비 현재 가격의 실제 손실률
  // = ((1 + current/100) / (1 + peak/100) - 1) × 100
  // 범위: -100% (주식이 0이 됨) ~ 0% (아직 고점)
  const buckets: [string, (v: number) => boolean][] = [
    ['0% (고점 유지)',    v => v >= -5],
    ['-5~-20%',         v => v < -5  && v >= -20],
    ['-20~-40%',        v => v < -20 && v >= -40],
    ['-40~-60%',        v => v < -40 && v >= -60],
    ['-60~-80%',        v => v < -60 && v >= -80],
    ['-80%~',           v => v < -80],
  ];
  const counts = new Map(buckets.map(([label]) => [label, 0]));
  for (const r of reports) {
    if (r.pct_change == null || r.peak_pct == null || r.peak_pct <= 0) continue;
    const trap = ((1 + r.pct_change / 100) / (1 + r.peak_pct / 100) - 1) * 100;
    for (const [label, pred] of buckets) {
      if (pred(trap)) { counts.set(label, (counts.get(label) ?? 0) + 1); break; }
    }
  }
  return buckets.map(([label]) => ({ range: label, count: counts.get(label) ?? 0 }));
}

function formatPrice(price: number | null): string {
  if (price == null) return '-';
  return price.toLocaleString('ko-KR') + '원';
}

function formatPct(pct: number | null): string {
  if (pct == null) return '-';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function formatUpdatedAt(iso: string): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function Home() {
  const data = loadReports();
  const reports = [...data.reports].sort((a, b) => b.report_date.localeCompare(a.report_date));

  const totalCount = reports.length;
  const profitList = reports.filter(r => (r.pct_change ?? 0) > 0);
  const lossList   = reports.filter(r => (r.pct_change ?? 0) < 0);
  const avgProfit =
    profitList.length > 0
      ? profitList.reduce((s, r) => s + (r.pct_change ?? 0), 0) / profitList.length
      : 0;
  const avgLoss =
    lossList.length > 0
      ? lossList.reduce((s, r) => s + (r.pct_change ?? 0), 0) / lossList.length
      : 0;

  const monthly = computeMonthly(data.reports);
  const peakBuckets = computePeakBuckets(data.reports);
  const daysToPeak = computeDaysToPeak(data.reports);
  const retentionBuckets = computeRetentionBuckets(data.reports);
  const themePumpVsCurrent = computeThemePumpVsCurrent(data.reports);
  const yearlyStats = computeYearlyStats(data.reports);
  const ageGroups = computeAgeGroups(data.reports);
  const peakTrapBuckets = computePeakTrapBuckets(data.reports);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          ValueFinder 수익률 트래커
        </h1>
        <p className="text-gray-400 text-sm">
          마지막 업데이트: {formatUpdatedAt(data.updated_at)}
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">추적 종목</p>
          <p className="text-2xl font-bold text-white">{totalCount}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">수익 종목</p>
          <p className="text-2xl font-bold text-emerald-400">{profitList.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">평균 수익</p>
          <p className="text-2xl font-bold text-emerald-400">
            {formatPct(avgProfit)}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">평균 손실</p>
          <p className="text-2xl font-bold text-red-400">
            {formatPct(avgLoss)}
          </p>
        </div>
      </div>

      {/* 인사이트 차트 */}
      <InsightCharts
        monthly={monthly}
        peakBuckets={peakBuckets}
        daysToPeak={daysToPeak}
        retentionBuckets={retentionBuckets}
        themePumpVsCurrent={themePumpVsCurrent}
        yearlyStats={yearlyStats}
        ageGroups={ageGroups}
        peakTrapBuckets={peakTrapBuckets}
      />

      {/* 테이블 */}
      {reports.length === 0 ? (
        <div className="text-center text-gray-500 py-16">데이터 없음</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">종목명</th>
                <th className="px-4 py-3 text-left">티커</th>
                <th className="px-4 py-3 text-left">작성일</th>
                <th className="px-4 py-3 text-right">작성일가</th>
                <th className="px-4 py-3 text-right">현재가</th>
                <th className="px-4 py-3 text-right">수익률</th>
                <th className="px-4 py-3 text-right">최고가</th>
                <th className="px-4 py-3 text-right">최고가일</th>
                <th className="px-4 py-3 text-right">최대수익</th>
                <th className="px-4 py-3 text-right">최저가</th>
                <th className="px-4 py-3 text-right">최저가일</th>
                <th className="px-4 py-3 text-right">최대손실</th>
                <th className="px-4 py-3 text-center">리포트</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => {
                const pct = r.pct_change ?? 0;
                const isPositive = pct > 0;
                const isNegative = pct < 0;
                return (
                  <tr
                    key={r.wr_id}
                    className={`border-t border-gray-800 hover:bg-gray-900/50 transition-colors ${
                      i % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/20'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-white">{r.company || '-'}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono">{r.ticker || '-'}</td>
                    <td className="px-4 py-3 text-gray-400">{r.report_date}</td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {formatPrice(r.price_on_date)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {formatPrice(r.latest_price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-bold font-mono ${
                          isPositive
                            ? 'text-emerald-400'
                            : isNegative
                            ? 'text-red-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {r.pct_change != null ? formatPct(r.pct_change) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {formatPrice(r.peak_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {r.peak_date ? r.peak_date.slice(2) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold font-mono text-yellow-400">
                        {r.peak_pct != null ? formatPct(r.peak_pct) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {formatPrice(r.trough_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {r.trough_date ? r.trough_date.slice(2) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold font-mono text-red-400">
                        {r.trough_pct != null ? formatPct(r.trough_pct) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs underline"
                      >
                        보기
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
