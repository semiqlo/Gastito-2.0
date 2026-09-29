import { Transaction, TransactionType } from '../domain/models';

export interface MindicadorItem {
  codigo: string;
  nombre: string;
  unidad_medida: string;
  fecha: string;
  valor: number;
}

export interface EconomicIndicatorsData {
  uf: MindicadorItem;
  dolar: MindicadorItem;
  euro: MindicadorItem;
  utm: MindicadorItem;
  fetchedAt: string;
  source: 'mindicador.cl' | 'referencia-local';
}

const FALLBACK_INDICATORS: EconomicIndicatorsData = {
  uf: {
    codigo: 'uf',
    nombre: 'Unidad de fomento (UF)',
    unidad_medida: 'Pesos',
    fecha: new Date().toISOString(),
    valor: 38425.62,
  },
  dolar: {
    codigo: 'dolar',
    nombre: 'Dólar observado',
    unidad_medida: 'Pesos',
    fecha: new Date().toISOString(),
    valor: 948.35,
  },
  euro: {
    codigo: 'euro',
    nombre: 'Euro',
    unidad_medida: 'Pesos',
    fecha: new Date().toISOString(),
    valor: 1034.8,
  },
  utm: {
    codigo: 'utm',
    nombre: 'Unidad Tributaria Mensual (UTM)',
    unidad_medida: 'Pesos',
    fecha: new Date().toISOString(),
    valor: 67429.0,
  },
  fetchedAt: new Date().toISOString(),
  source: 'referencia-local',
};

/**
 * Obtiene los indicadores económicos en tiempo real desde https://mindicador.cl/api
 */
export async function fetchMindicadorData(): Promise<EconomicIndicatorsData> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://mindicador.cl/api', {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data?.uf?.valor || !data?.dolar?.valor) {
      throw new Error('Respuesta incompleta de mindicador.cl');
    }

    return {
      uf: data.uf,
      dolar: data.dolar,
      euro: data.euro,
      utm: data.utm,
      fetchedAt: new Date().toISOString(),
      source: 'mindicador.cl',
    };
  } catch (err) {
    console.warn('Usando valores de respaldo para mindicador.cl:', err);
    return FALLBACK_INDICATORS;
  }
}

/**
 * Calcula estadísticas descriptivas avanzadas:
 * Promedio, Desviación Estándar Poblacional/Muestral, Coeficiente de Variación, Mediana, Mínimo, Máximo
 */
export function calculateStatisticalMetrics(values: number[]): {
  count: number;
  sum: number;
  mean: number;
  median: number;
  stdDev: number;
  cvPct: number;
  min: number;
  max: number;
} {
  if (values.length === 0) {
    return {
      count: 0,
      sum: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      cvPct: 0,
      min: 0,
      max: 0,
    };
  }

  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median =
    count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const variance =
    values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  const cvPct = mean > 0 ? (stdDev / mean) * 100 : 0;

  return {
    count,
    sum: Number(sum.toFixed(2)),
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    cvPct: Number(cvPct.toFixed(1)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[count - 1].toFixed(2)),
  };
}

export interface MonthlyComparisonPoint {
  dayLabel: string;
  dayEnd: number;
  currentMonthCumulative: number;
  previousMonthCumulative: number;
  diffPct: number;
}

export interface MonthlyTrendSummary {
  monthKey: string; // YYYY-MM
  label: string;
  expense: number;
  income: number;
  variationFromPrevPct: number;
}

const MONTH_SHORT_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

/**
 * Construye la curva comparativa acumulada del Mes Actual vs. Mes Anterior
 * dividida en 6 hitos del mes (Días 1-5, 6-10, 11-15, 16-20, 21-25, 26-Fin)
 * y el resumen estadístico de los últimos 6 meses.
 */
export function buildMonthlyComparisonAndTrend(
  transactions: Transaction[],
  selectedCategoryIds: Set<string>
): {
  currentMonthLabel: string;
  previousMonthLabel: string;
  currentMonthTotal: number;
  previousMonthTotal: number;
  monthOverMonthPct: number;
  dailyBurnRate: number;
  projectedMonthEnd: number;
  comparisonPoints: MonthlyComparisonPoint[];
  sixMonthTrend: MonthlyTrendSummary[];
  monthlyStdDev: number;
  monthlyMean: number;
  monthlyCvPct: number;
} {
  const now = new Date();
  const currYear = now.getFullYear();
  const currMonth = now.getMonth(); // 0-indexed

  const prevDate = new Date(currYear, currMonth - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();

  const currPrefix = `${currYear}-${String(currMonth + 1).padStart(2, '0')}`;
  const prevPrefix = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;

  const currentMonthLabel = `${MONTH_SHORT_NAMES[currMonth]} ${currYear}`;
  const previousMonthLabel = `${MONTH_SHORT_NAMES[prevMonth]} ${prevYear}`;

  const filteredExpenses = transactions.filter(
    (t) =>
      t.type === TransactionType.EXPENSE && selectedCategoryIds.has(t.categoryId)
  );

  const currMonthTxs = filteredExpenses.filter((t) =>
    t.date.startsWith(currPrefix)
  );
  const prevMonthTxs = filteredExpenses.filter((t) =>
    t.date.startsWith(prevPrefix)
  );

  const currentMonthTotal = currMonthTxs.reduce((s, t) => s + t.amount, 0);
  const previousMonthTotal = prevMonthTxs.reduce((s, t) => s + t.amount, 0);

  const monthOverMonthPct =
    previousMonthTotal > 0
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
      : currentMonthTotal > 0
      ? 100
      : 0;

  const currentDayOfMonth = Math.max(1, now.getDate());
  const daysInCurrentMonth = new Date(currYear, currMonth + 1, 0).getDate();
  const dailyBurnRate = currentMonthTotal / currentDayOfMonth;
  const projectedMonthEnd = dailyBurnRate * daysInCurrentMonth;

  // Puntos de control del mes: Día 5, 10, 15, 20, 25, Fin de mes (31)
  const checkpoints = [
    { label: 'Día 5', dayEnd: 5 },
    { label: 'Día 10', dayEnd: 10 },
    { label: 'Día 15', dayEnd: 15 },
    { label: 'Día 20', dayEnd: 20 },
    { label: 'Día 25', dayEnd: 25 },
    { label: 'Fin Mes', dayEnd: 31 },
  ];

  const comparisonPoints: MonthlyComparisonPoint[] = checkpoints.map((cp) => {
    const currSum = currMonthTxs
      .filter((t) => {
        const d = parseInt(t.date.split('-')[2] || '1', 10);
        return d <= cp.dayEnd;
      })
      .reduce((s, t) => s + t.amount, 0);

    const prevSum = prevMonthTxs
      .filter((t) => {
        const d = parseInt(t.date.split('-')[2] || '1', 10);
        return d <= cp.dayEnd;
      })
      .reduce((s, t) => s + t.amount, 0);

    const diffPct =
      prevSum > 0
        ? ((currSum - prevSum) / prevSum) * 100
        : currSum > 0
        ? 100
        : 0;

    return {
      dayLabel: cp.label,
      dayEnd: cp.dayEnd,
      currentMonthCumulative: Number(currSum.toFixed(2)),
      previousMonthCumulative: Number(prevSum.toFixed(2)),
      diffPct: Number(diffPct.toFixed(1)),
    };
  });

  // Tendencia de los últimos 6 meses
  const sixMonthTrend: MonthlyTrendSummary[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(currYear, currMonth - offset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = `${MONTH_SHORT_NAMES[m]} ${String(y).slice(2)}`;

    const exp = filteredExpenses
      .filter((t) => t.date.startsWith(prefix))
      .reduce((s, t) => s + t.amount, 0);

    const inc = transactions
      .filter(
        (t) => t.type === TransactionType.INCOME && t.date.startsWith(prefix)
      )
      .reduce((s, t) => s + t.amount, 0);

    const prevEntry =
      sixMonthTrend.length > 0 ? sixMonthTrend[sixMonthTrend.length - 1] : null;
    const variationFromPrevPct =
      prevEntry && prevEntry.expense > 0
        ? ((exp - prevEntry.expense) / prevEntry.expense) * 100
        : 0;

    sixMonthTrend.push({
      monthKey: prefix,
      label,
      expense: Number(exp.toFixed(2)),
      income: Number(inc.toFixed(2)),
      variationFromPrevPct: Number(variationFromPrevPct.toFixed(1)),
    });
  }

  const activeMonthsValues = sixMonthTrend
    .map((m) => m.expense)
    .filter((v) => v > 0);
  const stats = calculateStatisticalMetrics(
    activeMonthsValues.length > 0 ? activeMonthsValues : [currentMonthTotal]
  );

  return {
    currentMonthLabel,
    previousMonthLabel,
    currentMonthTotal: Number(currentMonthTotal.toFixed(2)),
    previousMonthTotal: Number(previousMonthTotal.toFixed(2)),
    monthOverMonthPct: Number(monthOverMonthPct.toFixed(1)),
    dailyBurnRate: Number(dailyBurnRate.toFixed(2)),
    projectedMonthEnd: Number(projectedMonthEnd.toFixed(2)),
    comparisonPoints,
    sixMonthTrend,
    monthlyStdDev: stats.stdDev,
    monthlyMean: stats.mean,
    monthlyCvPct: stats.cvPct,
  };
}
