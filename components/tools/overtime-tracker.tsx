"use client";

import { useState } from "react";
import { id as idLocale } from "date-fns/locale";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  Delete02Icon,
  TimeQuarterPassIcon,
  WorkHistoryIcon,
} from "@hugeicons/core-free-icons";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatCurrencyAmount, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { parseDateKey, toDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OvertimeEntry = {
  dateKey: string;
  overtimeHours: string;
  holidayWork: boolean;
};

const steps = ["Dasar", "Tanggal", "Hasil"];

function parseAmount(value: string) {
  return Number.parseFloat(value) || 0;
}

function createDateFromKey(dateKey: string) {
  return parseDateKey(dateKey);
}

function isWeekday(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function isSameMonth(dateKey: string, month: Date) {
  const date = createDateFromKey(dateKey);
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

function getWeekdayCount(month: Date) {
  const date = new Date(month.getFullYear(), month.getMonth(), 1);
  let count = 0;

  while (date.getMonth() === month.getMonth()) {
    if (isWeekday(date)) count += 1;
    date.setDate(date.getDate() + 1);
  }

  return count;
}

function formatDateLabel(dateKey: string) {
  return createDateFromKey(dateKey).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function calculateEntryTotal(
  entry: OvertimeEntry,
  hourlyRate: number,
  holidayHours: number,
  multiplierPercent: number,
  requiredHours: number
) {
  const multiplier = multiplierPercent / 100;
  const weekdayRequiredHours = isWeekday(createDateFromKey(entry.dateKey)) ? requiredHours : 0;
  const overtimePay = (parseAmount(entry.overtimeHours) + weekdayRequiredHours) * hourlyRate * multiplier;
  const holidayPay = entry.holidayWork ? holidayHours * hourlyRate * multiplier : 0;

  return overtimePay + holidayPay;
}

function calculateEntryExtraTotal(entry: OvertimeEntry, hourlyRate: number, holidayHours: number, multiplierPercent: number) {
  const multiplier = multiplierPercent / 100;
  const overtimePay = parseAmount(entry.overtimeHours) * hourlyRate * multiplier;
  const holidayPay = entry.holidayWork ? holidayHours * hourlyRate * multiplier : 0;

  return overtimePay + holidayPay;
}

function formatHourInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function getHeatmapClass(hours: number) {
  if (hours <= 0) return "";
  if (hours <= 1) return "bg-emerald-500/15 text-emerald-950 hover:bg-emerald-500/25 dark:text-emerald-50";
  if (hours <= 3) return "bg-emerald-500/35 text-emerald-950 hover:bg-emerald-500/45 dark:text-emerald-50";
  if (hours <= 6) return "bg-emerald-500/55 text-emerald-950 hover:bg-emerald-500/65 dark:text-emerald-50";
  return "bg-emerald-500/80 text-white hover:bg-emerald-500/90";
}

export function OvertimeTracker() {
  const { currency, setCurrency } = useCurrency();
  const [hourlyRate, setHourlyRate] = useState("");
  const [holidayHours, setHolidayHours] = useState("8");
  const [requiredOvertimeHours, setRequiredOvertimeHours] = useState("");
  const [multiplierPercent, setMultiplierPercent] = useState("150");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [overtimeHours, setOvertimeHours] = useState("");
  const [holidayWork, setHolidayWork] = useState(false);
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [step, setStep] = useState(0);

  const selectedDateKey = selectedDate ? toDateKey(selectedDate) : null;
  const baseRate = parseAmount(hourlyRate);
  const holidayHourCount = parseAmount(holidayHours);
  const requiredHourCount = parseAmount(requiredOvertimeHours);
  const multiplierRate = parseAmount(multiplierPercent);
  const currentMonthEntries = entries.filter((entry) => isSameMonth(entry.dateKey, calendarMonth));
  const weekdayCount = getWeekdayCount(calendarMonth);
  const requiredTotalHours = weekdayCount * requiredHourCount;
  const manualOvertimeHours = currentMonthEntries.reduce((total, entry) => total + parseAmount(entry.overtimeHours), 0);
  const totalHours = manualOvertimeHours + requiredTotalHours;
  const holidayDayCount = currentMonthEntries.filter((entry) => entry.holidayWork).length;
  const monthlyRequiredPay = requiredTotalHours * baseRate * (multiplierRate / 100);
  const monthlyExtraPay = currentMonthEntries.reduce(
    (total, entry) => total + calculateEntryExtraTotal(entry, baseRate, holidayHourCount, multiplierRate),
    0
  );
  const totalPay = monthlyRequiredPay + monthlyExtraPay;
  const canGoNext = step === 0 ? baseRate > 0 && holidayHourCount > 0 && multiplierRate > 0 : true;
  const selectedTotal = selectedDateKey
    ? calculateEntryTotal(
        { dateKey: selectedDateKey, overtimeHours, holidayWork },
        baseRate,
        holidayHourCount,
        multiplierRate,
        requiredHourCount
      )
    : 0;

  function handleSelectDate(date: Date | undefined) {
    setSelectedDate(date);

    if (!date) {
      setOvertimeHours("");
      setHolidayWork(false);
      return;
    }

    const existing = entries.find((entry) => entry.dateKey === toDateKey(date));
    setOvertimeHours(existing?.overtimeHours ?? "");
    setHolidayWork(existing?.holidayWork ?? false);
  }

  function saveSelectedDate() {
    if (!selectedDateKey) return;

    const entry: OvertimeEntry = {
      dateKey: selectedDateKey,
      overtimeHours,
      holidayWork,
    };
    const hasValue = parseAmount(overtimeHours) > 0 || holidayWork;

    setEntries((current) => {
      const withoutSelected = current.filter((item) => item.dateKey !== selectedDateKey);

      if (!hasValue) {
        return withoutSelected;
      }

      return [...withoutSelected, entry].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    });
  }

  function removeEntry(dateKey: string) {
    setEntries((current) => current.filter((entry) => entry.dateKey !== dateKey));

    if (selectedDateKey === dateKey) {
      setOvertimeHours("");
      setHolidayWork(false);
    }
  }

  function incrementOvertimeHours(hours: number) {
    setOvertimeHours((current) => formatHourInput(parseAmount(current) + hours));
  }

  function getHeatmapHours(date: Date) {
    const dateKey = toDateKey(date);
    const entry = entries.find((item) => item.dateKey === dateKey);
    const weekdayRequiredHours = isWeekday(date) ? requiredHourCount : 0;
    const manualHours = entry ? parseAmount(entry.overtimeHours) : 0;
    const holidayEntryHours = entry?.holidayWork ? holidayHourCount : 0;

    return weekdayRequiredHours + manualHours + holidayEntryHours;
  }

  return (
    <div className="space-y-5">
      <div className="mb-4 space-y-3">
        <div className="py-3 sm:py-4">
          <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
                Catat Lemburan
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HugeiconsIcon icon={Calendar03Icon} size={14} className="text-muted-foreground" />
              <span className="font-medium text-muted-foreground/70">{currentMonthEntries.length}</span>
              <span className="hidden sm:inline">hari</span>
              <span className="mx-0.5 text-muted-foreground/40">|</span>
              <HugeiconsIcon icon={TimeQuarterPassIcon} size={14} className="text-muted-foreground" />
              <span className="font-medium text-muted-foreground/70">{totalHours}</span>
              <span className="hidden sm:inline">jam</span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div
                className="text-2xl font-bold tracking-tight transition-all sm:text-3xl md:text-4xl"
                title={formatCurrencyAmount(totalPay, currency)}
              >
                {formatCurrencyAmount(totalPay, currency)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Estimasi bayaran lembur bulan kalender
              </p>
            </div>

            <Select value={currency} onValueChange={(code) => { void setCurrency(code); }}>
              <SelectTrigger className="h-9 w-24 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span>{c.flag} {c.name}</span>
                </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              className={index === step ? "h-1.5 bg-foreground" : "h-1.5 bg-muted"}
              onClick={() => setStep(index)}
              aria-label={`Step ${index + 1}: ${label}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Step {step + 1} dari {steps.length}</span>
          <span>{steps[step]}</span>
        </div>
      </div>

      {step === 0 ? (
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Dasar hitungan</p>
            <p className="text-xs text-muted-foreground">Isi bayaran dasar per jam dan durasi kerja hari libur.</p>
          </div>

          <div className="space-y-2">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Dasar per jam</p>
              <Input
                type="number"
                min={0}
                step="any"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
                placeholder="Contoh: 25000"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Jam kerja kalau hari libur</p>
              <Input
                type="number"
                min={0}
                step="any"
                value={holidayHours}
                onChange={(event) => setHolidayHours(event.target.value)}
                placeholder="8"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Lembur wajib per hari kerja</p>
              <Input
                type="number"
                min={0}
                step="any"
                value={requiredOvertimeHours}
                onChange={(event) => setRequiredOvertimeHours(event.target.value)}
                placeholder="Contoh: 1"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Besaran persen lembur</p>
              <Input
                type="number"
                min={0}
                step="any"
                value={multiplierPercent}
                onChange={(event) => setMultiplierPercent(event.target.value)}
                placeholder="150"
                className="h-9"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
            Lembur wajib otomatis masuk ke Senin-Jumat di bulan kalender. Weekend tidak kena lembur wajib.
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Catat tanggal</p>
            <p className="text-xs text-muted-foreground">Pilih tanggal, isi jam lembur, lalu tandai kalau kerja di hari libur.</p>
          </div>

          <div className="flex justify-center rounded-lg border bg-muted/20 p-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectDate}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              locale={idLocale}
              className="bg-transparent"
              components={{
                DayButton: (props) => {
                  const heatmapHours = getHeatmapHours(props.day.date);

                  return (
                    <CalendarDayButton
                      {...props}
                      locale={idLocale}
                      title={heatmapHours > 0 ? `${formatHourInput(heatmapHours)} jam lembur` : undefined}
                      className={cn(getHeatmapClass(heatmapHours), props.className)}
                    />
                  );
                },
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Heatmap jam lembur</span>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-emerald-500/15" />
              <span className="size-3 rounded-sm bg-emerald-500/35" />
              <span className="size-3 rounded-sm bg-emerald-500/55" />
              <span className="size-3 rounded-sm bg-emerald-500/80" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Jam lembur hari ini</p>
              <Input
                type="number"
                min={0}
                step="any"
                value={overtimeHours}
                onChange={(event) => setOvertimeHours(event.target.value)}
                placeholder="Contoh: 2.5"
                className="h-9"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => incrementOvertimeHours(1)}>
                  +1 jam
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => incrementOvertimeHours(0.5)}>
                  +30 menit
                </Button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={holidayWork} onCheckedChange={(checked) => setHolidayWork(checked === true)} />
              <span>Kerja di hari libur / Sabtu / tanggal merah</span>
            </label>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {selectedDateKey ? formatDateLabel(selectedDateKey) : "Pilih tanggal"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {parseAmount(overtimeHours)} jam lembur
                    {selectedDate && isWeekday(selectedDate) && requiredHourCount > 0 ? ` + ${requiredHourCount} jam wajib` : ""}
                    {holidayWork ? ` + ${holidayHourCount} jam hari libur` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">{formatCurrencyAmount(selectedTotal, currency)}</p>
              </div>
            </div>

            <Button size="sm" className="w-full" disabled={!selectedDateKey} onClick={saveSelectedDate}>
              Simpan tanggal
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Ringkasan</p>
              <p className="text-xs text-muted-foreground">Total mengikuti bulan yang sedang tampil di kalender.</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 py-2">
                <p className="inline-flex items-center gap-2 font-medium">
                  <HugeiconsIcon icon={TimeQuarterPassIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                  Jam lembur biasa
                </p>
                <span className="text-sm font-medium">{manualOvertimeHours} jam</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <p className="inline-flex items-center gap-2 font-medium">
                  <HugeiconsIcon icon={WorkHistoryIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                  Lembur wajib weekday
                </p>
                <span className="text-sm font-medium">{requiredTotalHours} jam</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <p className="inline-flex items-center gap-2 font-medium">
                  <HugeiconsIcon icon={WorkHistoryIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                  Kerja hari libur
                </p>
                <span className="text-sm font-medium">{holidayDayCount} hari</span>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-semibold">Tanggal tercatat</p>
              <p className="text-xs text-muted-foreground">Hapus tanggal kalau salah input.</p>
            </div>

            {currentMonthEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada tanggal tersimpan.</p>
            ) : (
              <div className="space-y-3">
                {currentMonthEntries.map((entry) => {
                  const entryTotal = calculateEntryTotal(entry, baseRate, holidayHourCount, multiplierRate, requiredHourCount);

                  return (
                    <div key={entry.dateKey} className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          handleSelectDate(createDateFromKey(entry.dateKey));
                          setStep(1);
                        }}
                      >
                        <p className="truncate text-sm font-semibold">{formatDateLabel(entry.dateKey)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {parseAmount(entry.overtimeHours)} jam lembur
                          {isWeekday(createDateFromKey(entry.dateKey)) && requiredHourCount > 0 ? ` · ${requiredHourCount} jam wajib` : ""}
                          {entry.holidayWork ? ` · ${holidayHourCount} jam hari libur` : ""}
                        </p>
                      </button>
                      <p className="shrink-0 font-semibold">{formatCurrencyAmount(entryTotal, currency)}</p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeEntry(entry.dateKey)}
                        title="Hapus tanggal"
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
          Kembali
        </Button>
        <Button size="sm" disabled={!canGoNext} onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>
          {step === steps.length - 1 ? "Selesai" : "Lanjut"}
        </Button>
      </div>
    </div>
  );
}
