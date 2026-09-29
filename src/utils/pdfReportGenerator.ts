import { jsPDF } from 'jspdf';
import {
  AppDatabaseState,
  Category,
  DebtType,
  TransactionType,
} from '../domain/models';
import { calculateAccountBalance, formatMoney } from '../data/localRepository';
import {
  calculateStatisticalMetrics,
  EconomicIndicatorsData,
  MonthlyComparisonPoint,
  MonthlyTrendSummary,
} from './economicIndicators';

export interface PdfReportSections {
  summary: boolean;
  indicators: boolean;
  monthlyTrend: boolean;
  categories: boolean;
  accounts: boolean;
  budgets: boolean;
  obligations: boolean;
  debts: boolean;
}

export interface PdfReportInput {
  dbState: AppDatabaseState;
  startDate: string;
  endDate: string;
  periodLabel: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  categoryBreakdown: {
    category: Category;
    total: number;
    count: number;
    mean: number;
    stdDev: number;
    cvPct: number;
    isChecked: boolean;
  }[];
  indicators: EconomicIndicatorsData | null;
  monthlyComparison: {
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
  };
  sections: PdfReportSections;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [4, 120, 87];
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [4, 120, 87];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Genera y descarga directamente un archivo .PDF nativo con jsPDF.
 * Incluye rango de fechas explícito, controles estadísticos (desviación estándar, CV%, burn rate),
 * indicadores económicos (UF, Dólar, Euro, UTM) y gráficos vectoriales de líneas y barras
 * incluso cuando los datos son $0.00.
 */
export function generateAndDownloadPdfReport(input: PdfReportInput): void {
  const {
    dbState,
    startDate,
    endDate,
    periodLabel,
    totalIncome,
    totalExpense,
    netBalance,
    categoryBreakdown,
    indicators,
    monthlyComparison,
    sections,
  } = input;

  const { accounts, transactions, transfers, budgets, obligations, debts, preferences, categories } =
    dbState;
  const currencySymbol = preferences.currencySymbol || '$';
  const configuredUserName =
    preferences.userName && preferences.userName.trim().length > 0
      ? preferences.userName.trim()
      : 'Usuario Principal';
  const assistantName = preferences.assistantName || 'Gastito';
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  // Estadísticas sobre los gastos del rango filtrado y categorías seleccionadas
  const rangeExpenses = transactions
    .filter(
      (t) =>
        t.type === TransactionType.EXPENSE &&
        t.date >= startDate &&
        t.date <= endDate
    )
    .map((t) => t.amount);
  const expenseStats = calculateStatisticalMetrics(rangeExpenses);
  const savingsRatePct =
    totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth(); // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const margin = 12;
  const contentW = pageW - margin * 2;
  let y = 12;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 14) {
      doc.addPage();
      y = 14;
      // Sutil encabezado en páginas siguientes
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 113, 108);
      doc.text(
        `GASTITO 2.0 — Informe PDF (${startDate} al ${endDate}) · Titular: ${configuredUserName}`,
        margin,
        9
      );
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, 10.5, pageW - margin, 10.5);
    }
  };

  // =========================================================================
  // CABECERA FORMAL CON LOGO OFICIAL GASTITO Y RANGO DE FECHAS
  // =========================================================================
  doc.setFillColor(4, 120, 87); // Emerald 700
  doc.roundedRect(margin, y, 13, 13, 3, 3, 'F');

  // Doble barra vertical tipo $ dentro del logo
  doc.setDrawColor(167, 243, 208);
  doc.setLineWidth(0.6);
  doc.line(margin + 5.3, y + 2.2, margin + 5.3, y + 10.8);
  doc.line(margin + 7.7, y + 2.2, margin + 7.7, y + 10.8);

  // Letra G estilizada en blanco
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('G', margin + 6.5, y + 8.5, { align: 'center' });

  // Títulos de cabecera
  doc.setTextColor(28, 25, 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('GASTITO 2.0 — INFORME ESTADÍSTICO Y FINANCIERO', margin + 16, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(87, 83, 78);
  doc.text(
    `Titular: ${configuredUserName}  |  Asistente: ${assistantName}  |  Emisión: ${
      new Date().toISOString().split('T')[0]
    }`,
    margin + 16,
    y + 9.5
  );

  // Cinta destacada de Rango de Fechas
  doc.setFillColor(236, 253, 245); // Emerald 50
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y + 15, contentW, 8, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70);
  doc.text(
    `RANGO DE FECHAS DEL INFORME: Desde ${startDate} hasta ${endDate} (${periodLabel})`,
    margin + 3,
    y + 20.2
  );

  y += 27;

  // =========================================================================
  // 1. RESUMEN DEL PERÍODO Y CONTROLES ECONÓMICOS / ESTADÍSTICOS
  // =========================================================================
  if (sections.summary) {
    ensureSpace(34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 25, 23);
    doc.text(
      `1. RESUMEN Y CONTROLES ECONÓMICOS (${startDate} al ${endDate})`,
      margin,
      y
    );
    y += 2.5;

    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(214, 211, 209);
    doc.roundedRect(margin, y, contentW, 25, 2, 2, 'FD');

    const kpis = [
      {
        label: 'INGRESOS RANGO',
        val: formatMoney(totalIncome, currencySymbol),
        sub: 'Total percibido',
      },
      {
        label: 'GASTOS RANGO',
        val: formatMoney(totalExpense, currencySymbol),
        sub: `n = ${expenseStats.count} mov.`,
      },
      {
        label: 'BALANCE NETO',
        val: `${netBalance >= 0 ? '+' : ''}${formatMoney(netBalance, currencySymbol)}`,
        sub: `Ahorro: ${savingsRatePct.toFixed(1)}%`,
      },
      {
        label: 'ACTUAL VS MES PASADO',
        val: `${monthlyComparison.monthOverMonthPct > 0 ? '+' : ''}${monthlyComparison.monthOverMonthPct.toFixed(
          1
        )}%`,
        sub: `Ant: ${formatMoney(monthlyComparison.previousMonthTotal, currencySymbol)}`,
      },
      {
        label: 'DESV. ESTÁNDAR (σ)',
        val: formatMoney(expenseStats.stdDev, currencySymbol),
        sub: `Mensual: ${formatMoney(monthlyComparison.monthlyStdDev, currencySymbol)}`,
      },
      {
        label: 'COEF. VARIACIÓN / PROM',
        val: `CV: ${expenseStats.cvPct.toFixed(1)}%`,
        sub: `μ: ${formatMoney(expenseStats.mean, currencySymbol)}`,
      },
    ];

    const colW = contentW / 3;
    kpis.forEach((k, idx) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const kx = margin + col * colW + 3;
      const ky = y + row * 12 + 4.2;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(120, 113, 108);
      doc.text(k.label, kx, ky);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(28, 25, 23);
      doc.text(k.val, kx, ky + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(120, 113, 108);
      doc.text(k.sub, kx + 34, ky + 4.2);
    });

    y += 30;
  }

  // =========================================================================
  // 2. INDICADORES ECONÓMICOS EN TIEMPO REAL (mindicador.cl)
  // =========================================================================
  if (sections.indicators && indicators) {
    ensureSpace(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 25, 23);
    doc.text(
      '2. INDICADORES ECONÓMICOS EN TIEMPO REAL (Fuente: mindicador.cl)',
      margin,
      y
    );
    y += 2.5;

    const indItems = [
      {
        code: 'UF (Unidad de Fomento)',
        val: `$${Math.round(indicators.uf.valor).toLocaleString('es-CL')}`,
      },
      {
        code: 'Dólar Observado (USD)',
        val: `$${Math.round(indicators.dolar.valor).toLocaleString('es-CL')}`,
      },
      {
        code: 'Euro (EUR)',
        val: `$${Math.round(indicators.euro.valor).toLocaleString('es-CL')}`,
      },
      {
        code: 'UTM (Unidad Trib. Mensual)',
        val: `$${Math.round(indicators.utm.valor).toLocaleString('es-CL')}`,
      },
    ];

    const boxW = (contentW - 6) / 4;
    indItems.forEach((item, i) => {
      const bx = margin + i * (boxW + 2);
      doc.setFillColor(245, 245, 244);
      doc.setDrawColor(214, 211, 209);
      doc.roundedRect(bx, y, boxW, 13, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(87, 83, 78);
      doc.text(item.code, bx + 2.5, y + 4.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(4, 120, 87);
      doc.text(item.val, bx + 2.5, y + 10.2);
    });

    y += 18;
  }

  // =========================================================================
  // 3. GRÁFICO DE LÍNEAS VECTORIAL (INCLUSO SI LOS DATOS SON CERO)
  // =========================================================================
  if (sections.monthlyTrend) {
    ensureSpace(78);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 25, 23);
    doc.text(
      `3. GRÁFICO DE LÍNEAS: EVOLUCIÓN MENSUAL (${monthlyComparison.currentMonthLabel} vs. ${monthlyComparison.previousMonthLabel})`,
      margin,
      y
    );
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(87, 83, 78);
    doc.text(
      `Rango evaluado: ${startDate} al ${endDate}  |  Actual: ${formatMoney(
        monthlyComparison.currentMonthTotal,
        currencySymbol
      )}  |  Mes Pasado: ${formatMoney(
        monthlyComparison.previousMonthTotal,
        currencySymbol
      )}  |  Ritmo Diario: ${formatMoney(
        monthlyComparison.dailyBurnRate,
        currencySymbol
      )}/día`,
      margin,
      y
    );
    y += 2.5;

    const chartBoxH = 44;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(214, 211, 209);
    doc.roundedRect(margin, y, contentW, chartBoxH, 2, 2, 'FD');

    const pts = monthlyComparison.comparisonPoints;
    const rawMax = Math.max(
      ...pts.map((p) =>
        Math.max(p.currentMonthCumulative, p.previousMonthCumulative)
      ),
      monthlyComparison.monthlyMean + monthlyComparison.monthlyStdDev
    );
    const maxLineVal = rawMax > 0 ? rawMax * 1.15 : 100;

    const plotL = margin + 18;
    const plotR = margin + contentW - 8;
    const plotT = y + 6;
    const plotB = y + chartBoxH - 8;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;

    const getX = (idx: number) =>
      plotL + (idx / Math.max(1, pts.length - 1)) * plotW;
    const getY = (val: number) =>
      plotB - Math.min(1, Math.max(0, val / maxLineVal)) * plotH;

    // Líneas guía horizontales (0%, 50%, 100%)
    [0, 0.5, 1].forEach((ratio) => {
      const gy = plotB - plotH * ratio;
      const gVal = rawMax > 0 ? Math.round(maxLineVal * ratio) : 0;
      doc.setDrawColor(231, 229, 228);
      doc.setLineWidth(0.2);
      doc.line(plotL, gy, plotR, gy);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(120, 113, 108);
      doc.text(`${currencySymbol}${gVal}`, plotL - 2, gy + 1, {
        align: 'right',
      });
    });

    // Banda y línea de promedio mensual (μ ± σ)
    const meanY = getY(monthlyComparison.monthlyMean);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.line(plotL, meanY, plotR, meanY);

    // Línea Mes Pasado (Ámbar)
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.6);
    for (let i = 0; i < pts.length - 1; i++) {
      doc.line(
        getX(i),
        getY(pts[i].previousMonthCumulative),
        getX(i + 1),
        getY(pts[i + 1].previousMonthCumulative)
      );
    }

    // Línea Mes Actual (Esmeralda)
    doc.setDrawColor(4, 120, 87);
    doc.setLineWidth(0.9);
    for (let i = 0; i < pts.length - 1; i++) {
      doc.line(
        getX(i),
        getY(pts[i].currentMonthCumulative),
        getX(i + 1),
        getY(pts[i + 1].currentMonthCumulative)
      );
    }

    // Puntos, porcentajes y etiquetas eje X
    pts.forEach((p, idx) => {
      const cx = getX(idx);
      const cyCurr = getY(p.currentMonthCumulative);
      const cyPrev = getY(p.previousMonthCumulative);

      // Punto mes pasado
      doc.setFillColor(245, 158, 11);
      doc.circle(cx, cyPrev, 0.9, 'F');

      // Punto mes actual
      doc.setFillColor(4, 120, 87);
      doc.circle(cx, cyCurr, 1.2, 'F');

      // Etiqueta de porcentaje sobre el punto
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(28, 25, 23);
      const pctText = p.diffPct > 0 ? `+${p.diffPct}%` : `${p.diffPct}%`;
      doc.text(pctText, cx, Math.max(plotT + 2, cyCurr - 2.2), {
        align: 'center',
      });

      // Etiqueta eje X
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(87, 83, 78);
      doc.text(p.dayLabel, cx, chartBoxH + y - 2.5, { align: 'center' });
    });

    y += chartBoxH + 3;

    // Resumen de tendencia últimos 6 meses
    const trendBoxW = (contentW - 5 * 1.5) / 6;
    monthlyComparison.sixMonthTrend.forEach((m, i) => {
      const tx = margin + i * (trendBoxW + 1.5);
      doc.setFillColor(250, 250, 249);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(tx, y, trendBoxW, 11, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(87, 83, 78);
      doc.text(m.label, tx + trendBoxW / 2, y + 3.5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(28, 25, 23);
      doc.text(
        formatMoney(m.expense, currencySymbol),
        tx + trendBoxW / 2,
        y + 7.2,
        { align: 'center' }
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(m.variationFromPrevPct <= 0 ? 4 : 225, m.variationFromPrevPct <= 0 ? 120 : 29, m.variationFromPrevPct <= 0 ? 87 : 72);
      doc.text(
        `${m.variationFromPrevPct > 0 ? '+' : ''}${m.variationFromPrevPct}%`,
        tx + trendBoxW / 2,
        y + 10,
        { align: 'center' }
      );
    });

    y += 15;
  }

  // =========================================================================
  // 4. GRÁFICO DE BARRAS POR CATEGORÍAS (INCLUSO SI LOS DATOS SON CERO)
  // =========================================================================
  if (sections.categories) {
    const checkedCategories = categoryBreakdown.filter((c) => c.isChecked);
    const displayBarItems = (
      checkedCategories.length > 0 ? checkedCategories : categoryBreakdown
    ).slice(0, 10);

    ensureSpace(64);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 25, 23);
    doc.text(
      `4. GRÁFICO DE BARRAS Y DESGLOSE POR CATEGORÍAS (${startDate} al ${endDate})`,
      margin,
      y
    );
    y += 3;

    // Contenedor del Gráfico de Barras Vectorial
    const barChartH = 38;
    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(214, 211, 209);
    doc.roundedRect(margin, y, contentW, barChartH, 2, 2, 'FD');

    const maxBarTotal = Math.max(
      0,
      ...displayBarItems.map((item) => item.total)
    );
    const barPlotL = margin + 8;
    const barPlotR = margin + contentW - 8;
    const barPlotT = y + 7;
    const barPlotB = y + barChartH - 9;
    const barPlotH = barPlotB - barPlotT;
    const barSlotW =
      (barPlotR - barPlotL) / Math.max(1, displayBarItems.length);

    // Línea base 0 del gráfico de barras
    doc.setDrawColor(168, 162, 158);
    doc.setLineWidth(0.3);
    doc.line(barPlotL, barPlotB, barPlotR, barPlotB);

    displayBarItems.forEach((item, idx) => {
      const slotCenter = barPlotL + idx * barSlotW + barSlotW / 2;
      const barW = Math.min(12, barSlotW * 0.55);
      const ratio =
        maxBarTotal > 0 ? item.total / maxBarTotal : 0;
      // Si el dato es 0, dibujamos una barra mínima base de 1.5mm para que el gráfico de barras sea siempre visible
      const actualBarH =
        item.total > 0 ? Math.max(2.5, ratio * barPlotH) : 1.5;
      const barY = barPlotB - actualBarH;

      const [r, g, b] = hexToRgb(item.category.color);
      doc.setFillColor(r, g, b);
      doc.roundedRect(
        slotCenter - barW / 2,
        barY,
        barW,
        actualBarH,
        1,
        1,
        'F'
      );

      const pct =
        totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;

      // Porcentaje / Monto encima de la barra
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(28, 25, 23);
      doc.text(`${pct.toFixed(0)}%`, slotCenter, barY - 1.2, {
        align: 'center',
      });

      // Nombre categoría debajo de la barra
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(68, 64, 60);
      const shortName =
        item.category.name.length > 10
          ? `${item.category.name.slice(0, 9)}.`
          : item.category.name;
      doc.text(shortName, slotCenter, barPlotB + 3.5, { align: 'center' });

      // Valor debajo del nombre
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(120, 113, 108);
      doc.text(
        formatMoney(item.total, currencySymbol),
        slotCenter,
        barPlotB + 6.8,
        { align: 'center' }
      );
    });

    y += barChartH + 4;

    // Tabla Estadística de Categorías Seleccionadas
    ensureSpace(16);
    doc.setFillColor(4, 120, 87);
    doc.rect(margin, y, contentW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('Categoría (Seleccionada)', margin + 2, y + 4.1);
    doc.text('Mov.', margin + 72, y + 4.1, { align: 'right' });
    doc.text('Promedio (μ)', margin + 104, y + 4.1, { align: 'right' });
    doc.text('Desv. Est. (σ)', margin + 136, y + 4.1, { align: 'right' });
    doc.text('% Gasto', margin + 158, y + 4.1, { align: 'right' });
    doc.text('Monto Total', margin + contentW - 2, y + 4.1, { align: 'right' });
    y += 6;

    const tableRows =
      checkedCategories.length > 0 ? checkedCategories : categoryBreakdown;
    tableRows.forEach((row, i) => {
      ensureSpace(6);
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentW, 5.5, 'F');
      }
      const pct = totalExpense > 0 ? (row.total / totalExpense) * 100 : 0;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(28, 25, 23);
      doc.text(row.category.name, margin + 2, y + 3.9);

      doc.setFont('helvetica', 'normal');
      doc.text(String(row.count), margin + 72, y + 3.9, { align: 'right' });
      doc.text(formatMoney(row.mean, currencySymbol), margin + 104, y + 3.9, {
        align: 'right',
      });
      doc.text(formatMoney(row.stdDev, currencySymbol), margin + 136, y + 3.9, {
        align: 'right',
      });
      doc.text(`${pct.toFixed(1)}%`, margin + 158, y + 3.9, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(
        formatMoney(row.total, currencySymbol),
        margin + contentW - 2,
        y + 3.9,
        { align: 'right' }
      );
      y += 5.5;
    });

    y += 5;
  }

  // =========================================================================
  // 5. SALDOS AUDITADOS POR CUENTA
  // =========================================================================
  if (sections.accounts) {
    ensureSpace(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 25, 23);
    doc.text('5. SALDOS AUDITADOS POR CUENTA', margin, y);
    y += 2.5;

    doc.setFillColor(245, 245, 244);
    doc.rect(margin, y, contentW, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(87, 83, 78);
    doc.text('Cuenta', margin + 2, y + 3.8);
    doc.text('Tipo', margin + 75, y + 3.8);
    doc.text('Saldo Inicial', margin + 135, y + 3.8, { align: 'right' });
    doc.text('Saldo Actual', margin + contentW - 2, y + 3.8, {
      align: 'right',
    });
    y += 5.5;

    if (accounts.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(120, 113, 108);
      doc.text(
        `Sin cuentas registradas (${currencySymbol}0.00)`,
        margin + 2,
        y + 4
      );
      y += 6;
    } else {
      accounts.forEach((acc) => {
        ensureSpace(5.5);
        const bal = calculateAccountBalance(acc, transactions, transfers);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(28, 25, 23);
        doc.text(acc.name, margin + 2, y + 3.8);
        doc.setFont('helvetica', 'normal');
        doc.text(acc.type, margin + 75, y + 3.8);
        doc.text(
          formatMoney(acc.initialBalance, currencySymbol),
          margin + 135,
          y + 3.8,
          { align: 'right' }
        );
        doc.setFont('helvetica', 'bold');
        doc.text(
          formatMoney(bal, currencySymbol),
          margin + contentW - 2,
          y + 3.8,
          { align: 'right' }
        );
        y += 5.2;
      });
    }
    y += 4;
  }

  // =========================================================================
  // 6. PRESUPUESTOS, PAGOS FIJOS Y DEUDAS
  // =========================================================================
  if (sections.budgets || sections.obligations || sections.debts) {
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 25, 23);
    doc.text('6. PRESUPUESTOS, OBLIGACIONES FIJAS Y DEUDAS', margin, y);
    y += 4;

    if (sections.budgets) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(4, 120, 87);
      doc.text(`• Presupuestos Activos (${budgets.length}):`, margin, y);
      y += 3.8;
      if (budgets.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120, 113, 108);
        doc.text('Sin presupuestos configurados.', margin + 4, y);
        y += 4.5;
      } else {
        budgets.forEach((b) => {
          ensureSpace(5);
          const spent = transactions
            .filter(
              (t) =>
                t.type === TransactionType.EXPENSE &&
                t.categoryId === b.categoryId &&
                t.date >= b.startDate
            )
            .reduce((s, t) => s + t.amount, 0);
          const pct = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(28, 25, 23);
          doc.text(
            `${catMap.get(b.categoryId) || 'Categoría'}: Gastado ${formatMoney(
              spent,
              currencySymbol
            )} de ${formatMoney(b.limitAmount, currencySymbol)} (${pct.toFixed(
              1
            )}%)`,
            margin + 4,
            y
          );
          y += 4.2;
        });
      }
    }

    if (sections.obligations) {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(4, 120, 87);
      doc.text(
        `• Recordatorios de Cuentas (Monto Variable / Fijo) (${obligations.length}):`,
        margin,
        y
      );
      y += 3.8;
      if (obligations.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120, 113, 108);
        doc.text('Sin recordatorios ni cuentas registradas.', margin + 4, y);
        y += 4.5;
      } else {
        obligations.forEach((o) => {
          ensureSpace(5.5);
          const linkedAll = transactions.filter(
            (t) =>
              t.linkedObligationId === o.id && t.type === TransactionType.EXPENSE
          );
          const linkedRange = linkedAll.filter(
            (t) => t.date >= startDate && t.date <= endDate
          );
          const histVals =
            linkedAll.length > 0
              ? linkedAll.map((t) => t.amount)
              : (o.paymentHistory || []).map((p) => p.amountPaid);
          const st = calculateStatisticalMetrics(histVals);
          const paidInRange =
            linkedRange.length > 0
              ? linkedRange.reduce((s, t) => s + t.amount, 0)
              : (o.paymentHistory || [])
                  .filter((p) => p.date >= startDate && p.date <= endDate)
                  .reduce((s, p) => s + p.amountPaid, 0);
          const lastPaid =
            o.lastPaidAmount ??
            (linkedAll.length > 0 ? linkedAll[0].amount : 0);

          const typeLabel = o.isVariableAmount
            ? 'Cuenta Variable'
            : 'Monto Fijo';
          const refText =
            o.amount > 0 ? formatMoney(o.amount, currencySymbol) : 'Variable';

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.8);
          doc.setTextColor(28, 25, 23);
          doc.text(
            `${o.name} [${typeLabel}] — Vence: ${
              o.dueDate
            } — Ref: ${refText} | Pagado en rango: ${formatMoney(
              paidInRange,
              currencySymbol
            )} | Último: ${formatMoney(
              lastPaid,
              currencySymbol
            )} | Prom(μ): ${formatMoney(
              st.mean,
              currencySymbol
            )} (σ: ${formatMoney(st.stdDev, currencySymbol)})`,
            margin + 4,
            y
          );
          y += 4.4;
        });
      }
    }

    if (sections.debts) {
      ensureSpace(8);
      const pendingDebts = debts.filter((d) => !d.isPaid);
      const owedToMe = pendingDebts
        .filter((d) => d.type === DebtType.OWED_TO_ME)
        .reduce((s, d) => s + d.amount, 0);
      const iOwe = pendingDebts
        .filter((d) => d.type === DebtType.I_OWE)
        .reduce((s, d) => s + d.amount, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(4, 120, 87);
      doc.text(
        `• Control de Deudas Pendientes (${pendingDebts.length}) — Me deben: ${formatMoney(
          owedToMe,
          currencySymbol
        )} | Debo: ${formatMoney(iOwe, currencySymbol)}`,
        margin,
        y
      );
      y += 4;
    }
  }

  const safeUser = configuredUserName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Gastito_2.0_Informe_${safeUser}_${startDate}_al_${endDate}.pdf`);
}
