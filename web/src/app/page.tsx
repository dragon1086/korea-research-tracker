import { readFileSync } from 'fs';
import { join } from 'path';
import InsightCharts, { MonthlyCount, ThemeStat, ReturnBucket, ThemePumpStat, YearlyStat, AgeStat } from './InsightCharts';
import ArumCharts, { ArumMonthlyStat, OutlookStat, TargetBucket, ArumAgeStat } from './ArumCharts';

// ── ValueFinder 타입 ───────────────────────────────────────────────
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

// ── 리서치알음 타입 ───────────────────────────────────────────────
interface ReportArum {
  index_no: number;
  company: string;
  ticker: string;
  title: string;
  report_date: string;
  outlook: string | null;
  target_price: number | null;
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

interface ResearcharumData {
  updated_at: string;
  reports: ReportArum[];
}

// ── 데이터 로드 ───────────────────────────────────────────────────
function loadReports(): ReportsData {
  try {
    const filePath = join(process.cwd(), 'public', 'reports.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { updated_at: '', reports: [] };
  }
}

function loadResearcharum(): ResearcharumData {
  try {
    const filePath = join(process.cwd(), 'public', 'researcharum.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { updated_at: '', reports: [] };
  }
}

// ── 테마 분류 ─────────────────────────────────────────────────────
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

// ── 날짜 유틸 ─────────────────────────────────────────────────────
function parseDate(s: string): Date | null {
  if (!s) return null;
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

// ── ValueFinder 인사이트 계산 ─────────────────────────────────────
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
    ['+0~10%',    v => v >= 0   && v < 10],
    ['+10~30%',   v => v >= 10  && v < 30],
    ['+30~50%',   v => v >= 30  && v < 50],
    ['+50~100%',  v => v >= 50  && v < 100],
    ['+100~200%', v => v >= 100 && v < 200],
    ['+200%~',    v => v >= 200],
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
  const buckets: [string, (v: number) => boolean][] = [
    ['음수 전환',         v => v < 0],
    ['0~25%',           v => v >= 0  && v < 25],
    ['25~50%',          v => v >= 25 && v < 50],
    ['50~75%',          v => v >= 50 && v < 75],
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
      theme, count,
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
      year, count,
      avgPeak: median(peaks),
      avgPeakMean: avg(peaks),
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
    ['1~3개월',   d => d > 30  && d <= 90],
    ['3~6개월',   d => d > 90  && d <= 180],
    ['6~12개월',  d => d > 180 && d <= 365],
    ['1~2년',     d => d > 365 && d <= 730],
    ['2년+',      d => d > 730],
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
  const buckets: [string, (v: number) => boolean][] = [
    ['0% (고점 유지)',  v => v >= -5],
    ['-5~-20%',       v => v < -5  && v >= -20],
    ['-20~-40%',      v => v < -20 && v >= -40],
    ['-40~-60%',      v => v < -40 && v >= -60],
    ['-60~-80%',      v => v < -60 && v >= -80],
    ['-80%~',         v => v < -80],
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

// ── 리서치알음 인사이트 계산 ──────────────────────────────────────

function computeArumMonthly(reports: ReportArum[]): ArumMonthlyStat[] {
  const map = new Map<string, number>();
  for (const r of reports) {
    if (!r.report_date) continue;
    const parts = r.report_date.split('-');
    if (parts.length < 2) continue;
    const key = `${parts[0]}-${parts[1]}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));
}

function computeOutlookStats(reports: ReportArum[]): OutlookStat[] {
  const labels = ['Positive', 'Neutral', 'Negative'];
  const keyMap: Record<string, string> = {
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
  };
  const groups = new Map<string, { peaks: number[]; currents: number[] }>(
    labels.map(l => [l, { peaks: [], currents: [] }])
  );
  for (const r of reports) {
    if (!r.outlook) continue;
    const label = keyMap[r.outlook.toLowerCase()];
    if (!label) continue;
    const g = groups.get(label)!;
    if (r.peak_pct != null) g.peaks.push(r.peak_pct);
    if (r.pct_change != null) g.currents.push(r.pct_change);
  }
  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
  return labels.map(label => {
    const g = groups.get(label)!;
    return {
      outlook: label,
      count: g.peaks.length + g.currents.length > 0
        ? Math.max(g.peaks.length, g.currents.length)
        : 0,
      avgPeak: avg(g.peaks),
      avgReturn: avg(g.currents),
      winRate: g.currents.length > 0
        ? Math.round(g.currents.filter(v => v > 0).length / g.currents.length * 100)
        : 0,
    };
  });
}

function computeTargetAchieveBuckets(reports: ReportArum[]): TargetBucket[] {
  const buckets: [string, (v: number) => boolean][] = [
    ['25% 미만',  v => v < 25],
    ['25~50%',   v => v >= 25  && v < 50],
    ['50~75%',   v => v >= 50  && v < 75],
    ['75~100%',  v => v >= 75  && v < 100],
    ['100~150%', v => v >= 100 && v < 150],
    ['150%+',    v => v >= 150],
  ];
  const counts = new Map(buckets.map(([label]) => [label, 0]));
  for (const r of reports) {
    if (r.target_price == null || r.latest_price == null || r.target_price === 0) continue;
    const pct = (r.latest_price / r.target_price) * 100;
    for (const [label, pred] of buckets) {
      if (pred(pct)) { counts.set(label, (counts.get(label) ?? 0) + 1); break; }
    }
  }
  return buckets.map(([label]) => ({ range: label, count: counts.get(label) ?? 0 }));
}

function computeTargetUpsideBuckets(reports: ReportArum[]): TargetBucket[] {
  const buckets: [string, (v: number) => boolean][] = [
    ['-20%+ 초과', v => v < -20],
    ['-20~0%',    v => v >= -20 && v < 0],
    ['0~20%',     v => v >= 0   && v < 20],
    ['20~50%',    v => v >= 20  && v < 50],
    ['50~100%',   v => v >= 50  && v < 100],
    ['100%+',     v => v >= 100],
  ];
  const counts = new Map(buckets.map(([label]) => [label, 0]));
  for (const r of reports) {
    if (r.target_price == null || r.latest_price == null || r.latest_price === 0) continue;
    const upside = (r.target_price - r.latest_price) / r.latest_price * 100;
    for (const [label, pred] of buckets) {
      if (pred(upside)) { counts.set(label, (counts.get(label) ?? 0) + 1); break; }
    }
  }
  return buckets.map(([label]) => ({ range: label, count: counts.get(label) ?? 0 }));
}

function computeArumPeakBuckets(reports: ReportArum[]): TargetBucket[] {
  const buckets: [string, (v: number) => boolean][] = [
    ['+0~10%',    v => v >= 0   && v < 10],
    ['+10~30%',   v => v >= 10  && v < 30],
    ['+30~50%',   v => v >= 30  && v < 50],
    ['+50~100%',  v => v >= 50  && v < 100],
    ['+100~200%', v => v >= 100 && v < 200],
    ['+200%~',    v => v >= 200],
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

function computeArumAgeGroups(reports: ReportArum[]): ArumAgeStat[] {
  const today = new Date();
  const AGE_BUCKETS: [string, (d: number) => boolean][] = [
    ['1개월 이내', d => d <= 30],
    ['1~3개월',   d => d > 30  && d <= 90],
    ['3~6개월',   d => d > 90  && d <= 180],
    ['6~12개월',  d => d > 180 && d <= 365],
    ['1~2년',     d => d > 365 && d <= 730],
    ['2년+',      d => d > 730],
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

// ── 포맷 유틸 ─────────────────────────────────────────────────────
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

function outlookBadge(outlook: string | null) {
  if (!outlook) return null;
  const map: Record<string, { label: string; cls: string }> = {
    positive: { label: 'Positive', cls: 'text-emerald-400 bg-emerald-400/10' },
    neutral:  { label: 'Neutral',  cls: 'text-yellow-400 bg-yellow-400/10'  },
    negative: { label: 'Negative', cls: 'text-red-400 bg-red-400/10'        },
  };
  return map[outlook] ?? null;
}

// ── 메인 페이지 ───────────────────────────────────────────────────
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = 'valuefinder' } = await searchParams;

  const vfData   = loadReports();
  const arumData = loadResearcharum();

  // ValueFinder 통계
  const vfReports   = [...vfData.reports].sort((a, b) => b.report_date.localeCompare(a.report_date));
  const vfProfit    = vfReports.filter(r => (r.pct_change ?? 0) > 0);
  const vfLoss      = vfReports.filter(r => (r.pct_change ?? 0) < 0);
  const vfAvgProfit = vfProfit.length > 0
    ? vfProfit.reduce((s, r) => s + (r.pct_change ?? 0), 0) / vfProfit.length : 0;
  const vfAvgLoss   = vfLoss.length > 0
    ? vfLoss.reduce((s, r) => s + (r.pct_change ?? 0), 0) / vfLoss.length : 0;

  const monthly          = computeMonthly(vfData.reports);
  const peakBuckets      = computePeakBuckets(vfData.reports);
  const daysToPeak       = computeDaysToPeak(vfData.reports);
  const retentionBuckets = computeRetentionBuckets(vfData.reports);
  const themePumpVsCurrent = computeThemePumpVsCurrent(vfData.reports);
  const yearlyStats      = computeYearlyStats(vfData.reports);
  const ageGroups        = computeAgeGroups(vfData.reports);
  const peakTrapBuckets  = computePeakTrapBuckets(vfData.reports);

  // 리서치알음 통계
  const arumReports  = [...arumData.reports].sort((a, b) => b.report_date.localeCompare(a.report_date));
  const arumProfit   = arumReports.filter(r => (r.pct_change ?? 0) > 0);
  const arumLoss     = arumReports.filter(r => (r.pct_change ?? 0) < 0);
  const arumAvgProfit = arumProfit.length > 0
    ? arumProfit.reduce((s, r) => s + (r.pct_change ?? 0), 0) / arumProfit.length : 0;
  const arumAvgLoss  = arumLoss.length > 0
    ? arumLoss.reduce((s, r) => s + (r.pct_change ?? 0), 0) / arumLoss.length : 0;
  const arumTargetHit = arumReports.filter(r =>
    r.target_price != null && r.latest_price != null && r.latest_price >= r.target_price
  ).length;
  void arumTargetHit; // kept for reference but not rendered

  const arumMonthly = computeArumMonthly(arumData.reports);
  const outlookStats = computeOutlookStats(arumData.reports);
  const targetAchieveBuckets = computeTargetAchieveBuckets(arumData.reports);
  const targetUpsideBuckets = computeTargetUpsideBuckets(arumData.reports);
  const arumPeakBuckets = computeArumPeakBuckets(arumData.reports);
  const arumAgeGroups = computeArumAgeGroups(arumData.reports);

  const updatedAt = tab === 'valuefinder'
    ? formatUpdatedAt(vfData.updated_at)
    : formatUpdatedAt(arumData.updated_at);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">

      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          리서치 수익률 트래커
        </h1>
        <p className="text-gray-400 text-sm">마지막 업데이트: {updatedAt}</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 mb-8 border-b border-gray-800">
        <a
          href="/?tab=valuefinder"
          className={`px-5 py-2.5 text-sm font-medium rounded-t transition-colors ${
            tab === 'valuefinder'
              ? 'text-white bg-gray-800 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
          }`}
        >
          ValueFinder
        </a>
        <a
          href="/?tab=researcharum"
          className={`px-5 py-2.5 text-sm font-medium rounded-t transition-colors ${
            tab === 'researcharum'
              ? 'text-white bg-gray-800 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
          }`}
        >
          리서치알음
        </a>
      </div>

      {/* ── ValueFinder 탭 ── */}
      {tab === 'valuefinder' && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">추적 종목</p>
              <p className="text-2xl font-bold text-white">{vfReports.length}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">수익 종목</p>
              <p className="text-2xl font-bold text-emerald-400">{vfProfit.length}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">평균 수익</p>
              <p className="text-2xl font-bold text-emerald-400">{formatPct(vfAvgProfit)}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">평균 손실</p>
              <p className="text-2xl font-bold text-red-400">{formatPct(vfAvgLoss)}</p>
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
          {vfReports.length === 0 ? (
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
                  {vfReports.map((r, i) => {
                    const pct = r.pct_change ?? 0;
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
                        <td className="px-4 py-3 text-right text-gray-300 font-mono">{formatPrice(r.price_on_date)}</td>
                        <td className="px-4 py-3 text-right text-gray-300 font-mono">{formatPrice(r.latest_price)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold font-mono ${pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {formatPct(r.pct_change)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300 font-mono">{formatPrice(r.peak_price)}</td>
                        <td className="px-4 py-3 text-right text-gray-400 text-xs">{r.peak_date ? r.peak_date.slice(2) : '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold font-mono text-yellow-400">{formatPct(r.peak_pct)}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300 font-mono">{formatPrice(r.trough_price)}</td>
                        <td className="px-4 py-3 text-right text-gray-400 text-xs">{r.trough_date ? r.trough_date.slice(2) : '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold font-mono text-red-400">{formatPct(r.trough_pct)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs underline">보기</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── 리서치알음 탭 ── */}
      {tab === 'researcharum' && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">추적 종목</p>
              <p className="text-2xl font-bold text-white">{arumReports.length}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">수익 종목</p>
              <p className="text-2xl font-bold text-emerald-400">{arumProfit.length}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">평균 수익</p>
              <p className="text-2xl font-bold text-emerald-400">{formatPct(arumAvgProfit)}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">평균 손실</p>
              <p className="text-2xl font-bold text-red-400">{formatPct(arumAvgLoss)}</p>
            </div>
          </div>

          <ArumCharts
            monthly={arumMonthly}
            outlookStats={outlookStats}
            targetAchieveBuckets={targetAchieveBuckets}
            targetUpsideBuckets={targetUpsideBuckets}
            peakBuckets={arumPeakBuckets}
            ageGroups={arumAgeGroups}
          />

          {/* 테이블 */}
          {arumReports.length === 0 ? (
            <div className="text-center text-gray-500 py-16">
              <p className="text-lg mb-2">데이터 수집 중...</p>
              <p className="text-sm">첫 크롤링 후 데이터가 표시됩니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">종목명</th>
                    <th className="px-4 py-3 text-left">티커</th>
                    <th className="px-4 py-3 text-left">전망</th>
                    <th className="px-4 py-3 text-left">작성일</th>
                    <th className="px-4 py-3 text-right">적정주가</th>
                    <th className="px-4 py-3 text-right">작성일가</th>
                    <th className="px-4 py-3 text-right">현재가</th>
                    <th className="px-4 py-3 text-right">수익률</th>
                    <th className="px-4 py-3 text-right">목표달성률</th>
                    <th className="px-4 py-3 text-right">최대수익</th>
                    <th className="px-4 py-3 text-right">최대손실</th>
                    <th className="px-4 py-3 text-center">리포트</th>
                  </tr>
                </thead>
                <tbody>
                  {arumReports.map((r, i) => {
                    const pct = r.pct_change ?? 0;
                    const targetAchieve =
                      r.target_price != null && r.latest_price != null
                        ? Math.round((r.latest_price / r.target_price) * 100)
                        : null;
                    const badge = outlookBadge(r.outlook);
                    return (
                      <tr
                        key={r.index_no}
                        className={`border-t border-gray-800 hover:bg-gray-900/50 transition-colors ${
                          i % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/20'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-white">{r.company || '-'}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono">{r.ticker || '-'}</td>
                        <td className="px-4 py-3">
                          {badge ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                              {badge.label}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{r.report_date}</td>
                        <td className="px-4 py-3 text-right text-gray-300 font-mono">{formatPrice(r.target_price)}</td>
                        <td className="px-4 py-3 text-right text-gray-300 font-mono">{formatPrice(r.price_on_date)}</td>
                        <td className="px-4 py-3 text-right text-gray-300 font-mono">{formatPrice(r.latest_price)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold font-mono ${pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {formatPct(r.pct_change)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {targetAchieve != null ? (
                            <span className={`font-mono text-xs ${targetAchieve >= 100 ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                              {targetAchieve}%
                              {targetAchieve >= 100 && ' ✓'}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold font-mono text-yellow-400">{formatPct(r.peak_pct)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold font-mono text-red-400">{formatPct(r.trough_pct)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs underline">보기</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
