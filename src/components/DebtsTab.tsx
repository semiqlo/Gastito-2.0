import React, { useState } from 'react';
import {
  DebtRecord,
  DebtType,
  SplitParticipant,
} from '../domain/models';
import {
  calculateDebtSimplification,
  formatMoney,
  triggerHaptic,
} from '../data/localRepository';
import {
  buildWhatsAppUrl,
  formatDebtWhatsAppMessage,
} from '../utils/exportManager';
import {
  Plus,
  Share2,
  CheckSquare,
  Square,
  Edit2,
  Trash2,
  Users,
  Calculator,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';

interface DebtsTabProps {
  debts: DebtRecord[];
  userName: string;
  currencySymbol: string;
  hapticEnabled: boolean;
  onAddDebt: (
    debt: Omit<DebtRecord, 'id' | 'createdAt' | 'isPaid'>,
    existingId?: string
  ) => void;
  onToggleDebtPaid: (id: string) => void;
  onDeleteDebt: (id: string) => void;
  onConvertSplitToDebts: (
    newDebts: Array<Omit<DebtRecord, 'id' | 'createdAt' | 'isPaid'>>
  ) => void;
}

export const DebtsTab: React.FC<DebtsTabProps> = ({
  debts,
  userName,
  currencySymbol,
  hapticEnabled,
  onAddDebt,
  onToggleDebtPaid,
  onDeleteDebt,
  onConvertSplitToDebts,
}) => {
  const [activeView, setActiveView] = useState<'DEBTS' | 'SPLIT'>('DEBTS');
  const [filterType, setFilterType] = useState<'ALL' | DebtType>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);

  // New / Edit Debt Form State
  const [editingDebtId, setEditingDebtId] = useState<string | undefined>(undefined);
  const [debtType, setDebtType] = useState<DebtType>(DebtType.OWED_TO_ME);
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  // Split Expense Tool State
  const myDisplayName = userName.trim() || 'Yo';
  const [splitTitle, setSplitTitle] = useState('Cena o salida grupal');
  const [participants, setParticipants] = useState<SplitParticipant[]>([
    { id: 'p-1', name: myDisplayName, amountPaid: 120 },
    { id: 'p-2', name: 'Martín Morales', amountPaid: 30 },
    { id: 'p-3', name: 'Sofía Herrera', amountPaid: 0 },
  ]);
  const [convertedSuccess, setConvertedSuccess] = useState(false);

  const pendingOwedToMe = debts
    .filter((d) => !d.isPaid && d.type === DebtType.OWED_TO_ME)
    .reduce((s, d) => s + d.amount, 0);

  const pendingIOwe = debts
    .filter((d) => !d.isPaid && d.type === DebtType.I_OWE)
    .reduce((s, d) => s + d.amount, 0);

  const filteredDebts = debts.filter((d) =>
    filterType === 'ALL' ? true : d.type === filterType
  );

  // Group by person for WhatsApp sharing
  const peopleNames = Array.from(
    new Set(filteredDebts.map((d) => d.personName.trim()))
  ).filter(Boolean);

  const resetDebtForm = () => {
    setEditingDebtId(undefined);
    setDebtType(DebtType.OWED_TO_ME);
    setPersonName('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setShowAddForm(false);
  };

  const handleStartEditDebt = (debt: DebtRecord) => {
    triggerHaptic(hapticEnabled, 12);
    setEditingDebtId(debt.id);
    setDebtType(debt.type);
    setPersonName(debt.personName);
    setAmount(String(debt.amount));
    setDate(debt.date);
    setDescription(debt.description);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!personName.trim() || !num || num <= 0) return;
    triggerHaptic(hapticEnabled, 18);
    onAddDebt(
      {
        type: debtType,
        personName: personName.trim(),
        amount: Number(num.toFixed(2)),
        date: date || new Date().toISOString().split('T')[0],
        description: description.trim(),
      },
      editingDebtId
    );
    resetDebtForm();
  };

  const handleCopyText = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedNotice(label);
      setTimeout(() => setCopiedNotice(null), 2500);
    }
  };

  // Split calculations
  const splitResult = calculateDebtSimplification(participants);

  const addParticipant = () => {
    setParticipants((prev) => [
      ...prev,
      { id: `p-${Date.now()}`, name: '', amountPaid: 0 },
    ]);
  };

  const updateParticipant = (
    id: string,
    field: 'name' | 'amountPaid',
    value: string
  ) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              [field]: field === 'amountPaid' ? parseFloat(value) || 0 : value,
            }
          : p
      )
    );
  };

  const removeParticipant = (id: string) => {
    if (participants.length <= 2) return;
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const buildSplitWhatsAppMessage = (): string => {
    const lines = [
      `*División de gastos en Gastito — ${splitTitle || 'Evento'}*`,
      `Gasto total: ${formatMoney(splitResult.totalExpense, currencySymbol)}`,
      `Cuota por persona (${participants.length}): ${formatMoney(
        splitResult.equalShare,
        currencySymbol
      )}`,
      '',
      '*Liquidación simplificada:*',
    ];
    if (splitResult.settlements.length === 0) {
      lines.push('• Todos están a mano.');
    } else {
      splitResult.settlements.forEach((s) => {
        lines.push(
          `• *${s.from}* paga a *${s.to}*: ${formatMoney(
            s.amount,
            currencySymbol
          )}`
        );
      });
    }
    return lines.join('\n');
  };

  const handleConvertSettlementsToDebts = () => {
    if (splitResult.settlements.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const recordsToCreate: Array<Omit<DebtRecord, 'id' | 'createdAt' | 'isPaid'>> = [];

    splitResult.settlements.forEach((s) => {
      const fromIsMe =
        s.from.toLowerCase() === myDisplayName.toLowerCase() ||
        s.from.toLowerCase() === 'yo';
      const toIsMe =
        s.to.toLowerCase() === myDisplayName.toLowerCase() ||
        s.to.toLowerCase() === 'yo';

      if (toIsMe) {
        recordsToCreate.push({
          type: DebtType.OWED_TO_ME,
          personName: s.from,
          amount: s.amount,
          date: todayStr,
          description: `División: ${splitTitle}`,
        });
      } else if (fromIsMe) {
        recordsToCreate.push({
          type: DebtType.I_OWE,
          personName: s.to,
          amount: s.amount,
          date: todayStr,
          description: `División: ${splitTitle}`,
        });
      } else {
        // Si es entre dos amigos, lo registramos con nota clara
        recordsToCreate.push({
          type: DebtType.OWED_TO_ME,
          personName: `${s.from} → ${s.to}`,
          amount: s.amount,
          date: todayStr,
          description: `División grupal: ${splitTitle}`,
        });
      }
    });

    if (recordsToCreate.length > 0) {
      triggerHaptic(hapticEnabled, 25);
      onConvertSplitToDebts(recordsToCreate);
      setConvertedSuccess(true);
      setTimeout(() => {
        setConvertedSuccess(false);
        setActiveView('DEBTS');
      }, 1400);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Switcher & Summary */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white">
              Deudas y División de Gastos
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control de múltiples deudas por persona, recordatorios por WhatsApp y calculadora de división
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl w-full">
            <button
              type="button"
              onClick={() => setActiveView('DEBTS')}
              className={`w-full min-h-[44px] px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 text-center leading-tight transition-all ${
                activeView === 'DEBTS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users size={16} className="shrink-0" />
              <span>Registro de Deudas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('SPLIT')}
              className={`w-full min-h-[44px] px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 text-center leading-tight transition-all ${
                activeView === 'SPLIT'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calculator size={16} className="shrink-0" />
              <span>Dividir Gasto Grupal</span>
            </button>
          </div>
        </div>

        {/* Summary Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Me deben (Pendiente de cobro)
            </div>
            <div className="text-xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatMoney(pendingOwedToMe, currencySymbol)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Debo (Pendiente de pago)
            </div>
            <div className="text-xl font-bold font-mono-num text-rose-600 dark:text-rose-400 mt-0.5">
              {formatMoney(pendingIOwe, currencySymbol)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Balance neto de deudas
            </div>
            <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-white mt-0.5">
              {formatMoney(pendingOwedToMe - pendingIOwe, currencySymbol)}
            </div>
          </div>
        </div>
      </section>

      {copiedNotice && (
        <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-between">
          <span>Mensaje copiado al portapapeles: {copiedNotice}</span>
          <Check size={15} />
        </div>
      )}

      {activeView === 'DEBTS' ? (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  filterType === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Todas ({debts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType(DebtType.OWED_TO_ME)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  filterType === DebtType.OWED_TO_ME
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Me deben
              </button>
              <button
                type="button"
                onClick={() => setFilterType(DebtType.I_OWE)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  filterType === DebtType.I_OWE
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Debo
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (showAddForm) {
                  resetDebtForm();
                } else {
                  setEditingDebtId(undefined);
                  setShowAddForm(true);
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 min-h-[40px]"
            >
              <Plus size={15} />
              <span>Registrar nueva deuda</span>
            </button>
          </div>

          {/* Add / Edit Debt Form */}
          {showAddForm && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-500/40 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {editingDebtId ? 'Editar deuda registrada' : 'Nueva deuda'}
                </h2>
                {editingDebtId && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Modificando registro existente
                  </span>
                )}
              </div>
              <form
                onSubmit={handleCreateDebt}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Tipo
                  </label>
                  <select
                    value={debtType}
                    onChange={(e) => setDebtType(e.target.value as DebtType)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  >
                    <option value={DebtType.OWED_TO_ME}>Me deben</option>
                    <option value={DebtType.I_OWE}>Debo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Persona
                  </label>
                  <input
                    type="text"
                    required
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder="Nombre de la persona"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Monto ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono-num text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Concepto..."
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetDebtForm}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                  >
                    {editingDebtId ? 'Actualizar deuda' : 'Guardar deuda'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Grouped by Person with Checkboxes & WhatsApp Share */}
          {peopleNames.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
              No hay deudas registradas en esta vista.
            </div>
          ) : (
            <div className="space-y-4">
              {peopleNames.map((person) => {
                const personDebts = filteredDebts.filter(
                  (d) => d.personName.trim() === person
                );
                const pendingItems = personDebts.filter((d) => !d.isPaid);
                const whatsappMsg = formatDebtWhatsAppMessage(
                  person,
                  (pendingItems.length > 0 ? pendingItems : personDebts).map((d) => ({
                    description: d.description,
                    amount: d.amount,
                    date: d.date,
                    type: d.type,
                  })),
                  currencySymbol
                );

                return (
                  <section
                    key={person}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {person}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {personDebts.length} registro(s) · {pendingItems.length} pendiente(s)
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyText(whatsappMsg, `Resumen de ${person}`)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                        >
                          <Copy size={13} />
                          <span>Copiar resumen</span>
                        </button>
                        <a
                          href={buildWhatsAppUrl(whatsappMsg)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Share2 size={13} />
                          <span>Compartir por WhatsApp</span>
                        </a>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                      {personDebts.map((debt) => (
                        <div
                          key={debt.id}
                          className="py-3 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic(hapticEnabled, 15);
                                onToggleDebtPaid(debt.id);
                              }}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title={
                                debt.isPaid ? 'Reabrir deuda' : 'Marcar como pagada'
                              }
                            >
                              {debt.isPaid ? (
                                <CheckSquare
                                  size={20}
                                  className="text-emerald-600 dark:text-emerald-400"
                                />
                              ) : (
                                <Square size={20} />
                              )}
                            </button>
                            <div className="min-w-0">
                              <div
                                className={`text-sm font-semibold truncate ${
                                  debt.isPaid
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {debt.description || 'Deuda registrada'}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {debt.type === DebtType.OWED_TO_ME
                                  ? 'Me deben'
                                  : 'Debo'}{' '}
                                · {debt.date} ·{' '}
                                {debt.isPaid ? 'Pagada (clic para reabrir)' : 'Pendiente'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span
                              className={`text-sm font-bold font-mono-num whitespace-nowrap mr-1 ${
                                debt.isPaid
                                  ? 'text-slate-400 line-through'
                                  : debt.type === DebtType.OWED_TO_ME
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatMoney(debt.amount, currencySymbol)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditDebt(debt)}
                              className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                              title="Editar deuda"
                              aria-label="Editar deuda"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDebt(debt.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Eliminar registro"
                              aria-label="Eliminar registro"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Expense Splitting & Debt Simplification Tool */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  1. Participantes y cuánto pagó cada quien
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ingresa cuánto aportó cada persona en la cuenta o salida
                </p>
              </div>
              <button
                type="button"
                onClick={addParticipant}
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1"
              >
                <Plus size={14} />
                <span>Añadir persona</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Concepto de la reunión o gasto compartido
              </label>
              <input
                type="text"
                value={splitTitle}
                onChange={(e) => setSplitTitle(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-2.5">
              {participants.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updateParticipant(p.id, 'name', e.target.value)}
                    placeholder="Nombre de participante"
                    className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                  <div className="w-36 relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.amountPaid || ''}
                      onChange={(e) =>
                        updateParticipant(p.id, 'amountPaid', e.target.value)
                      }
                      placeholder="Pagó 0.00"
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono-num text-right text-slate-900 dark:text-white"
                    />
                  </div>
                  {participants.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.id)}
                      className="p-2 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                2. Simplificación inteligente de deudas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Gastito reduce al mínimo la cantidad de transferencias entre amigos.
              </p>

              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 mb-5">
                <div>
                  <div className="text-xs text-slate-500">Total gastado</div>
                  <div className="text-lg font-bold font-mono-num text-slate-900 dark:text-white">
                    {formatMoney(splitResult.totalExpense, currencySymbol)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Cuota individual</div>
                  <div className="text-lg font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
                    {formatMoney(splitResult.equalShare, currencySymbol)}
                  </div>
                </div>
              </div>

              {splitResult.settlements.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  Todos aportaron exactamente lo mismo o falta ingresar montos.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {splitResult.settlements.map((s, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                        <strong className="text-rose-600 dark:text-rose-400">
                          {s.from}
                        </strong>
                        <ArrowRight size={14} className="text-slate-400" />
                        <span>paga a</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {s.to}
                        </strong>
                      </div>
                      <span className="text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                        {formatMoney(s.amount, currencySymbol)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              {convertedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold text-center">
                  ¡Deudas registradas automáticamente en tu lista!
                </div>
              )}
              <button
                type="button"
                disabled={splitResult.settlements.length === 0}
                onClick={handleConvertSettlementsToDebts}
                className="w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Plus size={15} />
                <span>Convertir resultado en deudas registradas</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(buildSplitWhatsAppMessage(), 'División grupal')
                  }
                  className="flex-1 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5"
                >
                  <Copy size={14} />
                  <span>Copiar desglose</span>
                </button>
                <a
                  href={buildWhatsAppUrl(buildSplitWhatsAppMessage())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Share2 size={14} />
                  <span>Enviar por WhatsApp</span>
                </a>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
