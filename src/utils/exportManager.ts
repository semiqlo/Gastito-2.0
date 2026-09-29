import {
  AppDatabaseState,
  TransactionType,
  DebtType,
} from '../domain/models';
import {
  calculateAccountBalance,
  calculateCreditCardMetrics,
  formatMoney,
} from '../data/localRepository';
import {
  calculateStatisticalMetrics,
  EconomicIndicatorsData,
} from './economicIndicators';

function escapeXml(unsafe: string | number | undefined | null): string {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildWorksheet(
  name: string,
  headers: string[],
  rows: (string | number)[][]
): string {
  const headerCells = headers
    .map(
      (h) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
    )
    .join('');

  const dataRows = rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          const isNum = typeof cell === 'number' && !Number.isNaN(cell);
          const type = isNum ? 'Number' : 'String';
          return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('\n');

  return `
  <Worksheet ss:Name="${escapeXml(name.slice(0, 31))}">
    <Table>
      <Row>${headerCells}</Row>
      ${dataRows}
    </Table>
  </Worksheet>`;
}

/**
 * Genera y descarga un archivo Excel (.xls) multi-hoja nativo con las 9 hojas requeridas:
 * Resumen, Movimientos, Cuentas, Transferencias, Deudas, Presupuestos, Pagos recurrentes, Categorías, Estadísticas
 * Incluye el nombre de usuario configurado en Ajustes, desviación estándar e indicadores de mindicador.cl.
 */
export function exportToMultiSheetExcel(
  state: AppDatabaseState,
  indicators?: EconomicIndicatorsData | null
): void {
  const {
    categories,
    accounts,
    transactions,
    transfers,
    debts,
    budgets,
    obligations,
    preferences,
  } = state;
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));

  const configuredUserName =
    preferences.userName && preferences.userName.trim().length > 0
      ? preferences.userName.trim()
      : 'Usuario Principal';

  const totalIncome = transactions
    .filter((t) => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  const expenseValues = transactions
    .filter((t) => t.type === TransactionType.EXPENSE)
    .map((t) => t.amount);
  const globalExpenseStats = calculateStatisticalMetrics(expenseValues);

  const resumenRows: (string | number)[][] = [
    ['Usuario Titular (Configuración)', configuredUserName, ''],
    ['Asistente Financiero', preferences.assistantName || 'Gastito', ''],
    ['Fecha de Exportación', new Date().toISOString().split('T')[0], ''],
    ['Total Ingresos', Math.round(totalIncome), preferences.currencySymbol],
    ['Total Gastos', Math.round(totalExpense), preferences.currencySymbol],
    ['Balance Neto del Período', Math.round(netBalance), preferences.currencySymbol],
    [
      'Desviación Estándar de Gastos (σ)',
      Math.round(globalExpenseStats.stdDev),
      preferences.currencySymbol,
    ],
    [
      'Coeficiente de Variación (CV%)',
      `${globalExpenseStats.cvPct}%`,
      '%',
    ],
    ['Total Cuentas Activas', accounts.filter((a) => !a.isArchived).length, ''],
    ['Total Movimientos Registrados', transactions.length, ''],
    ['Total Transferencias (No son gasto)', transfers.length, ''],
  ];

  if (indicators) {
    resumenRows.push(
      ['--- INDICADORES ECONÓMICOS (mindicador.cl) ---', '', ''],
      ['UF (Unidad de Fomento)', indicators.uf.valor, 'CLP ($)'],
      ['Dólar Observado', indicators.dolar.valor, 'CLP ($)'],
      ['Euro', indicators.euro.valor, 'CLP ($)'],
      ['UTM (Unidad Tributaria Mensual)', indicators.utm.valor, 'CLP ($)']
    );
  }

  // 1. Resumen
  const resumenSheet = buildWorksheet(
    'Resumen',
    ['Indicador / Campo', 'Valor', 'Moneda / Unidad'],
    resumenRows
  );

  // 2. Movimientos
  const movimientosSheet = buildWorksheet(
    'Movimientos',
    ['Usuario', 'Fecha', 'Tipo', 'Categoría', 'Monto', 'Cuenta', 'Descripción'],
    transactions.map((t) => [
      configuredUserName,
      t.date,
      t.type === TransactionType.EXPENSE ? 'Gasto' : 'Ingreso',
      catMap.get(t.categoryId) || 'Categoría archivada',
      Number(t.amount.toFixed(2)),
      accMap.get(t.accountId) || 'Cuenta',
      t.description || '',
    ])
  );

  // 3. Cuentas
  const cuentasSheet = buildWorksheet(
    'Cuentas',
    [
      'Titular',
      'Nombre Cuenta',
      'Tipo',
      'Saldo Inicial',
      'Saldo Actual',
      'Cupo Total TC',
      'Cupo Utilizado TC',
      'Cupo Disponible para Gastar',
      'Información Adicional',
    ],
    accounts.map((a) => {
      const isCredit = a.type === 'CREDIT';
      const ccMetrics = isCredit
        ? calculateCreditCardMetrics(a, transactions, transfers, obligations)
        : null;
      return [
        configuredUserName,
        a.name,
        a.type,
        Math.round(a.initialBalance),
        Math.round(calculateAccountBalance(a, transactions, transfers)),
        ccMetrics ? Math.round(ccMetrics.creditLimit) : '',
        ccMetrics ? Math.round(ccMetrics.totalUsedCredit) : '',
        ccMetrics ? Math.round(ccMetrics.availableCredit) : '',
        a.additionalInfo || '',
      ];
    })
  );

  // 4. Transferencias
  const transferenciasSheet = buildWorksheet(
    'Transferencias',
    ['Usuario', 'Fecha', 'Cuenta Origen', 'Cuenta Destino', 'Monto', 'Descripción'],
    transfers.map((tr) => [
      configuredUserName,
      tr.date,
      accMap.get(tr.fromAccountId) || tr.fromAccountId,
      accMap.get(tr.toAccountId) || tr.toAccountId,
      Number(tr.amount.toFixed(2)),
      tr.description || '',
    ])
  );

  // 5. Deudas
  const deudasSheet = buildWorksheet(
    'Deudas',
    ['Usuario', 'Tipo', 'Persona', 'Monto', 'Fecha', 'Estado', 'Descripción'],
    debts.map((d) => [
      configuredUserName,
      d.type === DebtType.OWED_TO_ME ? 'Me deben' : 'Debo',
      d.personName,
      Number(d.amount.toFixed(2)),
      d.date,
      d.isPaid ? 'Pagada' : 'Pendiente',
      d.description || '',
    ])
  );

  // 6. Presupuestos
  const presupuestosSheet = buildWorksheet(
    'Presupuestos',
    ['Categoría', 'Período', 'Monto Límite', 'Gastado Actual', 'Porcentaje Uso', 'Fecha Inicio'],
    budgets.map((b) => {
      const spent = transactions
        .filter(
          (t) =>
            t.type === TransactionType.EXPENSE && t.categoryId === b.categoryId
        )
        .reduce((s, t) => s + t.amount, 0);
      const pct =
        b.limitAmount > 0
          ? Number(((spent / b.limitAmount) * 100).toFixed(1))
          : 0;
      return [
        catMap.get(b.categoryId) || b.categoryId,
        b.period,
        Number(b.limitAmount.toFixed(2)),
        Number(spent.toFixed(2)),
        pct,
        b.startDate,
      ];
    })
  );

  // 7. Pagos recurrentes / Recordatorios de Cuentas Variables, Fijas, Cuotas TC y Suscripciones
  const recurrentesSheet = buildWorksheet(
    'Pagos recurrentes',
    [
      'Nombre Recordatorio / Cuenta',
      'Modalidad',
      'Categoría',
      'Monto Mensual / Referencial',
      'Cuotas (Pagadas/Total)',
      'Fecha Término Cuotas',
      'Último Monto Pagado',
      'Promedio Histórico (μ)',
      'Desv. Estándar (σ)',
      'Cuenta',
      'Próximo Vencimiento',
      'Periodicidad',
      'Estado',
    ],
    obligations.map((o) => {
      const linkedAll = transactions.filter(
        (t) =>
          t.linkedObligationId === o.id && t.type === TransactionType.EXPENSE
      );
      const histVals =
        linkedAll.length > 0
          ? linkedAll.map((t) => t.amount)
          : (o.paymentHistory || []).map((p) => p.amountPaid);
      const st = calculateStatisticalMetrics(histVals);
      const lastPaid =
        o.lastPaidAmount ?? (linkedAll.length > 0 ? linkedAll[0].amount : 0);

      const modeLabel = o.isInstallmentPlan
        ? 'Compra en Cuotas TC'
        : o.isSubscription
        ? 'Suscripción Automática TC'
        : o.isVariableAmount
        ? 'Monto Variable (Cuenta)'
        : 'Monto Fijo';

      return [
        o.name,
        modeLabel,
        catMap.get(o.categoryId) || o.categoryId,
        Math.round(o.amount),
        o.isInstallmentPlan
          ? `${o.paidInstallments || 0}/${o.totalInstallments || 1}`
          : 'N/A',
        o.endDate || 'Indefinido',
        Math.round(lastPaid),
        Math.round(st.mean),
        Math.round(st.stdDev),
        accMap.get(o.accountId) || o.accountId,
        o.dueDate,
        o.frequency,
        o.status === 'PAID' ? 'Completado / Pagado' : 'Activo / Pendiente',
      ];
    })
  );

  // 8. Categorías
  const categoriasSheet = buildWorksheet(
    'Categorías',
    ['ID', 'Nombre', 'Tipo', 'Estado', 'Archivada'],
    categories.map((c) => [
      c.id,
      c.name,
      c.type,
      c.isActive ? 'Activa' : 'Inactiva',
      c.isDeleted ? 'Sí (Soft-delete)' : 'No',
    ])
  );

  // 9. Estadísticas (incluye Desviación Estándar σ y Coeficiente de Variación CV%)
  const statsRows: (string | number)[][] = categories
    .filter((c) => !c.isDeleted)
    .map((c) => {
      const catTxs = transactions.filter((t) => t.categoryId === c.id);
      const values = catTxs.map((t) => t.amount);
      const st = calculateStatisticalMetrics(values);
      const pctOfExpense =
        totalExpense > 0 && c.type !== TransactionType.INCOME
          ? Number(((st.sum / totalExpense) * 100).toFixed(1))
          : 0;
      return [
        c.name,
        st.count,
        st.sum,
        pctOfExpense,
        st.mean,
        st.stdDev,
        st.cvPct,
        st.min,
        st.max,
      ];
    });

  const estadisticasSheet = buildWorksheet(
    'Estadísticas',
    [
      'Categoría',
      'Cantidad Movimientos',
      'Total Acumulado',
      '% del Gasto Total',
      'Promedio (μ)',
      'Desviación Estándar (σ)',
      'Coef. Variación (CV%)',
      'Mínimo',
      'Máximo',
    ],
    statsRows
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#047857" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${resumenSheet}
  ${movimientosSheet}
  ${cuentasSheet}
  ${transferenciasSheet}
  ${deudasSheet}
  ${presupuestosSheet}
  ${recurrentesSheet}
  ${categoriasSheet}
  ${estadisticasSheet}
</Workbook>`;

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  const safeUserSlug = configuredUserName.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.href = url;
  link.download = `Gastito_2.0_Reporte_${safeUserSlug}_${dateStr}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportDatabaseBackupJson(state: AppDatabaseState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  const configuredUserName =
    state.preferences.userName && state.preferences.userName.trim().length > 0
      ? state.preferences.userName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'Usuario';
  link.href = url;
  link.download = `Gastito_2.0_Backup_${configuredUserName}_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function formatDebtWhatsAppMessage(
  personName: string,
  items: { description: string; amount: number; date: string; type: DebtType }[],
  symbol = '$'
): string {
  const owedToMe = items.filter((i) => i.type === DebtType.OWED_TO_ME);
  const iOwe = items.filter((i) => i.type === DebtType.I_OWE);

  const totalOwedToMe = owedToMe.reduce((s, i) => s + i.amount, 0);
  const totalIOwe = iOwe.reduce((s, i) => s + i.amount, 0);
  const net = totalOwedToMe - totalIOwe;

  const lines: string[] = [
    `Hola ${personName}, te comparto el resumen de nuestras cuentas en *Gastito*:`,
  ];
  items.forEach((item) => {
    const label =
      item.type === DebtType.OWED_TO_ME
        ? 'Pendiente a mi favor'
        : 'Pendiente a tu favor';
    lines.push(
      `• ${item.date}: ${item.description || 'Registro'} — ${formatMoney(
        item.amount,
        symbol
      )} (${label})`
    );
  });

  if (net > 0) {
    lines.push(`\n*Saldo neto a mi favor:* ${formatMoney(net, symbol)}`);
  } else if (net < 0) {
    lines.push(
      `\n*Saldo neto a tu favor:* ${formatMoney(Math.abs(net), symbol)}`
    );
  } else {
    lines.push(`\n*Saldo neto:* Estamos a mano (${symbol}0.00)`);
  }

  return lines.join('\n');
}
