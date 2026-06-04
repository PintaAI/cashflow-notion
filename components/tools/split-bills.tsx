"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Camera01Icon,
  Delete02Icon,
  Edit02Icon,
  Image01Icon,
  Loading03Icon,
  UserGroupIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { CameraCapture } from "@/components/camera-capture";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatCurrencyAmount, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Person = {
  id: string;
  name: string;
};

type BillItem = {
  id: string;
  name: string;
  amount: string;
  participantIds: string[];
};

type Bill = {
  id: string;
  place: string;
  payerId: string;
  items: BillItem[];
};

type PersonSummary = Person & {
  paid: number;
  share: number;
  balance: number;
};

type Settlement = {
  fromId: string;
  toId: string;
  amount: number;
};

type ExtractedSplitBillItem = {
  name: string;
  amount: number;
};

type ExtractSplitBillResponse = {
  success: boolean;
  data?: {
    place: string | null;
    total: number | null;
    items: ExtractedSplitBillItem[];
  };
  error?: string;
};

const initialPeople: Person[] = [
  { id: "person-1", name: "Aku" },
  { id: "person-2", name: "Teman" },
];

const initialBills: Bill[] = [];

function parseAmount(value: string) {
  return Number.parseFloat(value) || 0;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getPersonName(people: Person[], id: string) {
  return people.find((person) => person.id === id)?.name || "Unknown";
}

function calculateSummaries(people: Person[], bills: Bill[]) {
  const summaries = new Map<string, PersonSummary>();

  for (const person of people) {
    summaries.set(person.id, { ...person, paid: 0, share: 0, balance: 0 });
  }

  for (const bill of bills) {
    const payer = summaries.get(bill.payerId);
    const billTotal = bill.items.reduce((total, item) => total + parseAmount(item.amount), 0);

    if (payer) {
      payer.paid += billTotal;
    }

    for (const item of bill.items) {
      const participants = item.participantIds.filter((id) => summaries.has(id));

      if (participants.length === 0) {
        continue;
      }

      const share = parseAmount(item.amount) / participants.length;

      for (const participantId of participants) {
        const participant = summaries.get(participantId);

        if (participant) {
          participant.share += share;
        }
      }
    }
  }

  return Array.from(summaries.values()).map((summary) => ({
    ...summary,
    balance: summary.paid - summary.share,
  }));
}

function calculateSettlements(summaries: PersonSummary[]) {
  const debtors = summaries
    .filter((summary) => summary.balance < -0.01)
    .map((summary) => ({ id: summary.id, amount: Math.abs(summary.balance) }));
  const creditors = summaries
    .filter((summary) => summary.balance > 0.01)
    .map((summary) => ({ id: summary.id, amount: summary.balance }));
  const settlements: Settlement[] = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      settlements.push({ fromId: debtor.id, toId: creditor.id, amount });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= 0.01) {
      debtorIndex += 1;
    }

    if (creditor.amount <= 0.01) {
      creditorIndex += 1;
    }
  }

  return settlements;
}

function getPaidPlaces(personId: string, bills: Bill[]) {
  return bills
    .filter((bill) => bill.payerId === personId)
    .map((bill) => ({
      id: bill.id,
      place: bill.place.trim() || "Tanpa nama",
      amount: bill.items.reduce((total, item) => total + parseAmount(item.amount), 0),
      itemCount: bill.items.length,
    }))
    .filter((bill) => bill.amount > 0 || bill.itemCount > 0);
}

export function SplitBills() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currency, setCurrency } = useCurrency();
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isSharingPng, setIsSharingPng] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const summaries = calculateSummaries(people, bills);
  const settlements = calculateSettlements(summaries);
  const totalPaid = summaries.reduce((total, summary) => total + summary.paid, 0);
  const editingBill = bills.find((bill) => bill.id === editingBillId) ?? null;
  const steps = ["Orang", "Tempat", "Pesanan", "Hasil"];
  const canGoNext = step === 0 ? people.some((person) => person.name.trim()) : step === 1 ? bills.length > 0 : true;

  function updatePersonName(personId: string, name: string) {
    setPeople((current) =>
      current.map((person) => (person.id === personId ? { ...person, name } : person))
    );
  }

  function addPerson() {
    const person: Person = {
      id: createId("person"),
      name: `Teman ${people.length}`,
    };

    setPeople((current) => [...current, person]);
  }

  function removePerson(personId: string) {
    if (people.length <= 1) {
      return;
    }

    const fallbackPersonId = people.find((person) => person.id !== personId)?.id;

    setPeople((current) => current.filter((person) => person.id !== personId));
    setBills((current) =>
      current.map((bill) => ({
        ...bill,
        payerId: bill.payerId === personId && fallbackPersonId ? fallbackPersonId : bill.payerId,
        items: bill.items.map((item) => ({
          ...item,
          participantIds: item.participantIds.filter((id) => id !== personId),
        })),
      }))
    );
  }

  function addBill() {
    const firstPersonId = people[0]?.id || "";
    const billId = createId("bill");

    setBills((current) => [
      ...current,
      {
        id: billId,
        place: "",
        payerId: firstPersonId,
        items: [],
      },
    ]);
    setEditingBillId(billId);
  }

  function removeBill(billId: string) {
    setBills((current) => current.filter((bill) => bill.id !== billId));
    setEditingBillId((current) => (current === billId ? null : current));
  }

  function updateBill(billId: string, updates: Partial<Pick<Bill, "place" | "payerId">>) {
    setBills((current) =>
      current.map((bill) => (bill.id === billId ? { ...bill, ...updates } : bill))
    );
  }

  function addItem(billId: string) {
    const allPersonIds = people.map((person) => person.id);

    setBills((current) =>
      current.map((bill) =>
        bill.id === billId
          ? {
              ...bill,
              items: [
                ...bill.items,
                {
                  id: createId("item"),
                  name: "Item baru",
                  amount: "0",
                  participantIds: allPersonIds,
                },
              ],
            }
          : bill
      )
    );
  }

  function removeItem(billId: string, itemId: string) {
    setBills((current) =>
      current.map((bill) =>
        bill.id === billId
          ? { ...bill, items: bill.items.filter((item) => item.id !== itemId) }
          : bill
      )
    );
  }

  function updateItem(
    billId: string,
    itemId: string,
    updates: Partial<Pick<BillItem, "name" | "amount" | "participantIds">>
  ) {
    setBills((current) =>
      current.map((bill) =>
        bill.id === billId
          ? {
              ...bill,
              items: bill.items.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item
              ),
            }
          : bill
      )
    );
  }

  function toggleParticipant(billId: string, item: BillItem, personId: string) {
    const participantIds = item.participantIds.includes(personId)
      ? item.participantIds.filter((id) => id !== personId)
      : [...item.participantIds, personId];

    updateItem(billId, item.id, { participantIds });
  }

  function appendExtractedItems(billId: string, items: ExtractedSplitBillItem[], place?: string | null) {
    const participantIds = people.map((person) => person.id);
    const extractedItems = items
      .filter((item) => item.name.trim() && item.amount > 0)
      .map((item) => ({
        id: createId("item"),
        name: item.name.trim(),
        amount: String(Math.round(item.amount)),
        participantIds,
      }));

    if (extractedItems.length === 0) {
      setExtractError("Tidak ada item yang terbaca.");
      return;
    }

    setBills((current) =>
      current.map((bill) =>
        bill.id === billId
          ? {
              ...bill,
              place: bill.place.trim() || place?.trim() || bill.place,
              items: [
                ...bill.items.filter((item) => parseAmount(item.amount) > 0 || item.name !== "Item baru"),
                ...extractedItems,
              ],
            }
          : bill
      )
    );
  }

  async function extractSplitBillImage(file: File, billId: string) {
    setIsExtracting(true);
    setExtractError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("currency", currency);

      const response = await fetch("/api/extract-split-bill", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as ExtractSplitBillResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Gagal membaca struk.");
      }

      const extractedItems = result.data.items.length > 0
        ? result.data.items
        : result.data.total
          ? [{ name: "Total struk", amount: result.data.total }]
          : [];

      appendExtractedItems(billId, extractedItems, result.data.place);
    } catch (error) {
      setExtractError(error instanceof Error ? error.message : "Gagal membaca struk.");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleCameraCapture(imageData: string) {
    setShowCamera(false);

    if (!editingBillId) {
      return;
    }

    const response = await fetch(imageData);
    const blob = await response.blob();
    const file = new File([blob], "split-bill-receipt.jpg", { type: "image/jpeg" });

    await extractSplitBillImage(file, editingBillId);
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !editingBillId) {
      return;
    }

    extractSplitBillImage(file, editingBillId);
  }

  function drawWrappedText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = text.split(" ");
    let line = "";
    let currentY = y;

    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;

      if (context.measureText(nextLine).width > maxWidth && line) {
        context.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = nextLine;
      }
    }

    if (line) {
      context.fillText(line, x, currentY);
    }

    return currentY + lineHeight;
  }

  function createSummaryPngBlob() {
    return new Promise<Blob>((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const width = 1080;
      const height = 1350;
      const padding = 72;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas tidak tersedia."));
        return;
      }

      canvas.width = width;
      canvas.height = height;

      context.fillStyle = "#fafafa";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#111827";
      context.font = "700 54px sans-serif";
      context.fillText("Split Bill", padding, 110);

      context.fillStyle = "#6b7280";
      context.font = "400 28px sans-serif";
      context.fillText(`${people.length} orang · ${bills.length} tempat · ${formatCurrencyAmount(totalPaid, currency)}`, padding, 158);

      let y = 235;
      context.fillStyle = "#111827";
      context.font = "700 34px sans-serif";
      context.fillText("Ringkasan", padding, y);
      y += 46;

      context.font = "400 28px sans-serif";
      for (const summary of summaries) {
        const paidPlaces = getPaidPlaces(summary.id, bills);
        const balanceText = `${summary.balance >= 0 ? "+" : "-"}${formatCurrencyAmount(Math.abs(summary.balance), currency)}`;
        context.fillStyle = "#111827";
        context.fillText(summary.name || "Tanpa nama", padding, y);
        context.textAlign = "right";
        context.fillStyle = summary.balance >= 0 ? "#111827" : "#dc2626";
        context.fillText(balanceText, width - padding, y);
        context.textAlign = "left";
        y += 36;
        context.fillStyle = "#6b7280";
        context.font = "400 23px sans-serif";
        context.fillText(
          `Dibayar ${formatCurrencyAmount(summary.paid, currency)} · Konsumsi ${formatCurrencyAmount(summary.share, currency)}`,
          padding,
          y
        );
        y += 34;

        for (const bill of paidPlaces.slice(0, 3)) {
          context.fillText(`Bayar di ${bill.place}: ${formatCurrencyAmount(bill.amount, currency)}`, padding + 24, y);
          y += 30;
        }

        if (paidPlaces.length > 3) {
          context.fillText(`+${paidPlaces.length - 3} tempat lain`, padding + 24, y);
          y += 30;
        }

        y += 22;
        context.font = "400 28px sans-serif";
      }

      y += 24;
      context.strokeStyle = "#e5e7eb";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(padding, y);
      context.lineTo(width - padding, y);
      context.stroke();
      y += 68;

      context.fillStyle = "#111827";
      context.font = "700 34px sans-serif";
      context.fillText("Pembayaran akhir", padding, y);
      y += 50;

      if (settlements.length === 0) {
        context.fillStyle = "#6b7280";
        context.font = "400 28px sans-serif";
        drawWrappedText(context, "Belum ada yang perlu dibayar.", padding, y, width - padding * 2, 38);
      } else {
        context.font = "400 30px sans-serif";
        for (const settlement of settlements) {
          const text = `${getPersonName(people, settlement.fromId)} bayar ke ${getPersonName(people, settlement.toId)}`;
          context.fillStyle = "#111827";
          context.fillText(text, padding, y);
          context.textAlign = "right";
          context.font = "700 30px sans-serif";
          context.fillText(formatCurrencyAmount(settlement.amount, currency), width - padding, y);
          context.textAlign = "left";
          context.font = "400 30px sans-serif";
          y += 52;
        }
      }

      context.fillStyle = "#9ca3af";
      context.font = "400 22px sans-serif";
      context.fillText("Generated by Cashflow Tracker", padding, height - 56);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Gagal membuat PNG."));
        }
      }, "image/png");
    });
  }

  async function shareSummaryPng() {
    setIsSharingPng(true);
    setShareMessage(null);

    try {
      const blob = await createSummaryPngBlob();
      const file = new File([blob], "split-bill-summary.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Split Bill Summary",
          text: "Pembayaran akhir split bill",
          files: [file],
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "split-bill-summary.png";
      link.click();
      URL.revokeObjectURL(url);
      setShareMessage("PNG di-download.");
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Gagal membuat PNG.");
    } finally {
      setIsSharingPng(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 mb-4">
        <div className="py-3 sm:py-4">
          <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
                Split Bill
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HugeiconsIcon
                icon={UserGroupIcon}
                size={14}
                className="text-muted-foreground"
              />
              <span className="font-medium text-muted-foreground/70">
                {people.length}
              </span>
              <span className="hidden sm:inline">orang</span>
              <span className="mx-0.5 text-muted-foreground/40">|</span>
              <HugeiconsIcon
                icon={Wallet01Icon}
                size={14}
                className="text-muted-foreground"
              />
              <span className="font-medium text-muted-foreground/70">
                {bills.length}
              </span>
              <span className="hidden sm:inline">tempat</span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div
                className="text-2xl font-bold tracking-tight transition-all sm:text-3xl md:text-4xl"
                title={formatCurrencyAmount(totalPaid, currency)}
              >
                {formatCurrencyAmount(totalPaid, currency)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Total dibayar dari semua tempat
              </p>
            </div>

          <Select value={currency} onValueChange={(code) => { void setCurrency(code); }}>
            <SelectTrigger className="h-9 w-24 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1">
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
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Siapa saja?</p>
              <p className="text-xs text-muted-foreground">Masukkan orang yang ikut split.</p>
            </div>
            <Button size="icon-sm" variant="outline" onClick={addPerson} title="Tambah orang">
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-2">
                <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  value={person.name}
                  onChange={(event) => updatePersonName(person.id, event.target.value)}
                  className="h-9"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={people.length <= 1}
                  onClick={() => removePerson(person.id)}
                  title="Hapus orang"
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Bayar di mana?</p>
              <p className="text-xs text-muted-foreground">Tambah tempat dan pilih siapa yang bayar.</p>
            </div>
            <Button size="icon-sm" onClick={addBill} title="Tambah tempat">
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            </Button>
          </div>

          {bills.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Belum ada tempat. Tambah tempat dulu untuk lanjut.
            </div>
          ) : null}

          <div className="space-y-2">
            {bills.map((bill, billIndex) => (
              <div key={bill.id} className="flex items-center gap-2">
                <Input
                  value={bill.place}
                  onChange={(event) => updateBill(bill.id, { place: event.target.value })}
                  placeholder={`Tempat ${billIndex + 1}`}
                  className="h-9 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                />
                <Select
                  value={bill.payerId}
                  onValueChange={(payerId) => updateBill(bill.id, { payerId })}
                >
                  <SelectTrigger className="h-9 w-32 shrink-0 sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name || "Tanpa nama"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeBill(bill.id)}
                  title="Hapus tempat"
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Makan apa saja?</p>
            <p className="text-xs text-muted-foreground">Buka tiap tempat untuk isi item dan yang konsumsi.</p>
          </div>

          <div className="space-y-1">
            {bills.map((bill) => {
              const billTotal = bill.items.reduce((total, item) => total + parseAmount(item.amount), 0);

              return (
                <div key={bill.id} className="flex items-center gap-3 py-2">
                  <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-4 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setEditingBillId(bill.id)}
                  >
                    <p className="truncate text-sm font-medium">{bill.place || "Tanpa nama"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {bill.items.length} item · {formatCurrencyAmount(billTotal, currency)}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={() => setEditingBillId(bill.id)}
                    title="Edit pesanan"
                  >
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Ringkasan</p>
              <p className="text-xs text-muted-foreground">Balance positif berarti dia harus menerima uang.</p>
            </div>

            <div className="space-y-1">
              {summaries.map((summary) => {
                const paidPlaces = getPaidPlaces(summary.id, bills);

                return (
                  <div key={summary.id} className="py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="inline-flex items-center gap-2 font-medium">
                        <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                        {summary.name || "Tanpa nama"}
                      </p>
                      <span className={summary.balance >= 0 ? "text-sm font-medium" : "text-sm font-medium text-destructive"}>
                        {summary.balance >= 0 ? "+" : "-"}
                        {formatCurrencyAmount(Math.abs(summary.balance), currency)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
                      <span>Dibayar {formatCurrencyAmount(summary.paid, currency)}</span>
                      <span>Konsumsi {formatCurrencyAmount(summary.share, currency)}</span>
                    </div>
                    {paidPlaces.length > 0 ? (
                      <div className="mt-1 space-y-0.5 pl-6 text-xs text-muted-foreground">
                        {paidPlaces.map((bill) => (
                          <div key={bill.id} className="flex items-center justify-between gap-3">
                            <span className="truncate">Bayar di {bill.place}</span>
                            <span className="shrink-0">{formatCurrencyAmount(bill.amount, currency)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Pembayaran akhir</p>
                <p className="text-xs text-muted-foreground">Transfer minimum supaya semua impas.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={shareSummaryPng}
                disabled={isSharingPng}
              >
                {isSharingPng ? (
                  <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="size-4" />
                )}
                PNG
              </Button>
            </div>

            {shareMessage ? (
              <p className="text-xs text-muted-foreground">{shareMessage}</p>
            ) : null}

            {settlements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada yang perlu dibayar. Isi harga item dan peserta konsumsi untuk melihat hasil.
              </p>
            ) : (
              <div className="space-y-3">
                {settlements.map((settlement, index) => (
                  <div
                    key={`${settlement.fromId}-${settlement.toId}-${index}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <p className="text-sm">
                      <span className="font-semibold">{getPersonName(people, settlement.fromId)}</span> bayar ke{" "}
                      <span className="font-semibold">{getPersonName(people, settlement.toId)}</span>
                    </p>
                    <p className="shrink-0 font-semibold">
                      {formatCurrencyAmount(settlement.amount, currency)}
                    </p>
                  </div>
                ))}
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

      <Drawer open={Boolean(editingBill)} onOpenChange={(open) => !open && setEditingBillId(null)}>
        <DrawerContent className="mx-auto max-h-[90vh] max-w-md data-[vaul-drawer-direction=bottom]:rounded-t-2xl">
          {editingBill ? (
            <>
              {showCamera ? (
                <CameraCapture
                  onCapture={handleCameraCapture}
                  onClose={() => setShowCamera(false)}
                />
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isExtracting}
              />
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-4" />
                  <Input
                    value={editingBill.place}
                    onChange={(event) => updateBill(editingBill.id, { place: event.target.value })}
                    placeholder="Nama tempat"
                    className="h-8 rounded-md border-0 bg-transparent px-2 text-sm font-medium shadow-none focus-visible:ring-0"
                  />
                </DrawerTitle>
                <p className="text-xs text-muted-foreground">
                  Dibayar oleh {getPersonName(people, editingBill.payerId)}
                </p>
              </DrawerHeader>

              <div className="space-y-4 overflow-y-auto px-4 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Items</p>
                    <p className="text-xs text-muted-foreground">
                      Total {formatCurrencyAmount(
                        editingBill.items.reduce((total, item) => total + parseAmount(item.amount), 0),
                        currency
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setShowCamera(true)}
                      disabled={isExtracting}
                      title="Ambil foto struk"
                    >
                      {isExtracting ? (
                        <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
                      ) : (
                        <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-4" />
                      )}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isExtracting}
                      title="Upload gambar struk"
                    >
                      <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="size-4" />
                    </Button>
                    <Button size="icon-sm" variant="outline" onClick={() => addItem(editingBill.id)} title="Tambah item">
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
                    </Button>
                  </div>
                </div>

                {isExtracting ? (
                  <p className="text-xs text-muted-foreground">Membaca struk...</p>
                ) : null}
                {extractError ? (
                  <p className="text-xs text-destructive">{extractError}</p>
                ) : null}

                {editingBill.items.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Belum ada item. Tambah manual atau pakai camera/upload struk.
                  </div>
                ) : null}

                <div className="space-y-4">
                  {editingBill.items.map((item) => {
                    const amount = parseAmount(item.amount);
                    const participantCount = item.participantIds.length;
                    const itemShare = participantCount > 0 ? amount / participantCount : 0;

                    return (
                      <div key={item.id} className="space-y-2 border-b pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <Input
                            value={item.name}
                            onChange={(event) =>
                              updateItem(editingBill.id, item.id, { name: event.target.value })
                            }
                            placeholder="Item"
                            className="h-9 min-w-0 flex-1"
                          />
                          <Input
                            type="number"
                            value={item.amount}
                            onChange={(event) =>
                              updateItem(editingBill.id, item.id, { amount: event.target.value })
                            }
                            min={0}
                            step="any"
                            placeholder="0"
                            className="h-9 w-28 shrink-0"
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(editingBill.id, item.id)}
                            title="Hapus item"
                          >
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">Dimakan oleh</p>
                            <span className="text-xs text-muted-foreground">
                              {participantCount > 0
                                ? `${formatCurrencyAmount(itemShare, currency)} / orang`
                                : "Pilih orang"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-2">
                            {people.map((person) => (
                              <label key={person.id} className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                  checked={item.participantIds.includes(person.id)}
                                  onCheckedChange={() => toggleParticipant(editingBill.id, item, person.id)}
                                />
                                <span className="truncate">{person.name || "Tanpa nama"}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
