import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Cookie, Plus } from "lucide-react-native";
import { useTheme } from "../theme";
import { CATS, CAT_COLORS } from "../theme/colors";
import { Sheet, Field, inputStyle } from "./Sheet";
import { Chip, Stepper } from "./Bits";
import { PrimaryButton } from "./PrimaryButton";
import { SuccessBurst } from "./SuccessBurst";
import { useApp } from "../store/appStore";
import { addCheck, addSnack, logSnack } from "../data/repo";
import { PRESETS, UNITS } from "../data/presets";
import { useDay } from "../ui/derive";
import { clock, slotLabel } from "../lib/slots";
import { pct } from "../ui/format";
import type { Option } from "../lib/planner";
import { haptics } from "../services/haptics";

type SnackPick = { id: string | null; name: string; cat: string; unit: string; kcal: number } | null;

// Выбор перекуса: живой поиск по кладовой и пресетам, новый — отдельной шторкой.
function SnackPicker({ value, onChange, onNew, onlyPantry }: { value: SnackPick; onChange: (p: SnackPick) => void; onNew?: () => void; onlyPantry?: boolean }) {
  const t = useTheme();
  const snacks = useApp((s) => s.snacks);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const known = new Set(snacks.map((s) => s.name.toLowerCase()));
  const options = [
    ...snacks.filter((s) => !s.archived).map((s) => ({ id: s.id as string | null, name: s.name, cat: s.cat, unit: s.unit, kcal: s.label_kcal })),
    ...(onlyPantry ? [] : PRESETS.filter((p) => !known.has(p.name.toLowerCase())).map((p) => ({ id: null as string | null, ...p }))),
  ].filter((o) => !query || o.name.toLowerCase().includes(query));
  return (
    <View style={{ gap: 10 }}>
      <TextInput value={q} onChangeText={setQ} placeholder="Search snacks" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.slice(0, 16).map((o) => (
          <Chip key={o.name} a11y={`Snack ${o.name}`} label={o.name} color={CAT_COLORS[o.cat]} active={value?.name === o.name} onPress={() => onChange(value?.name === o.name ? null : o)} />
        ))}
        {onNew ? <Chip a11y="New snack" label="New snack" icon={<Plus size={14} color={t.colors.ink} />} active={false} onPress={onNew} /> : null}
      </View>
      {options.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Nothing matches — add it as a new snack.</Text> : null}
    </View>
  );
}

const WHEN = [
  { label: "Now", ago: 0 },
  { label: "30 min ago", ago: 30 },
  { label: "1 h ago", ago: 60 },
  { label: "2 h ago", ago: 120 },
];

export function LogSheet({ visible, preset, onClose, onSaved, onNew }: { visible: boolean; preset: string | null; onClose: () => void; onSaved: (m: string) => void; onNew: () => void }) {
  const t = useTheme();
  const { snacks, today, minute, refresh } = useApp();
  const day = useDay();
  const [pick, setPick] = useState<SnackPick>(null);
  const [pieces, setPieces] = useState(1);
  const [ago, setAgo] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const s = snacks.find((x) => x.id === preset);
    setPick(s ? { id: s.id, name: s.name, cat: s.cat, unit: s.unit, kcal: s.label_kcal } : null);
    setPieces(1);
    setAgo(0);
  }, [visible]);
  const info = pick?.id ? day.info.get(pick.id) : null;
  const est = info ? info.portion.mean * pieces : (pick?.kcal ?? 0) * pieces;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Log a snack"
      subtitle="Counted in pieces — the app learns what your handful really is."
      footer={
        <PrimaryButton
          label={pick ? `Log · ~${Math.round(est)} kcal` : "Pick a snack"}
          disabled={!pick}
          onPress={async () => {
            if (!pick) return;
            const id = pick.id ?? (await addSnack(pick.name, pick.cat, pick.unit, pick.kcal));
            await logSnack(id, pieces, today, Math.max(0, minute - ago));
            await refresh();
            haptics.success();
            onClose();
            onSaved(`${pick.name} · ${Math.round(est)} kcal`);
          }}
        />
      }
    >
      <Field label="Snack">
        <SnackPicker value={pick} onChange={setPick} onNew={onNew} />
      </Field>
      <Field label={pick ? `How many (${pick.unit})` : "How many"} hint={info && info.portion.checks > 0 ? `Your ${pick?.unit} is about ${Math.round(info.portion.mean)} kcal, from ${info.portion.checks.toFixed(1)} weighted checks.` : "Uses the label until you check a portion."}>
        <Stepper value={pieces} onChange={setPieces} step={0.5} min={0.5} max={10} />
      </Field>
      <Field label="When">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {WHEN.map((w) => (
            <Chip key={w.label} label={w.ago === 0 ? `Now · ${clock(minute)}` : w.label} active={ago === w.ago} onPress={() => setAgo(w.ago)} />
          ))}
        </View>
      </Field>
    </Sheet>
  );
}

export function NewSnackSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const t = useTheme();
  const { refresh } = useApp();
  const [name, setName] = useState("");
  const [cat, setCat] = useState<string>("Sweet");
  const [unit, setUnit] = useState<string>("piece");
  const [kcal, setKcal] = useState(100);
  useEffect(() => {
    if (!visible) return;
    setName("");
    setCat("Sweet");
    setUnit("piece");
    setKcal(100);
  }, [visible]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="New snack"
      subtitle="Label calories for one unit — checks refine it later."
      footer={
        <PrimaryButton
          label="Add to pantry"
          disabled={!name.trim()}
          onPress={async () => {
            await addSnack(name.trim(), cat, unit, kcal);
            await refresh();
            haptics.success();
            onClose();
            onSaved(`${name.trim()} added`);
          }}
        />
      }
    >
      <Field label="Name">
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Salted caramel bites" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
      </Field>
      <Field label="Kind">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATS.map((c) => (
            <Chip key={c} label={c} color={CAT_COLORS[c]} active={cat === c} onPress={() => setCat(c)} />
          ))}
        </View>
      </Field>
      <Field label="Counted as">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {UNITS.map((u) => (
            <Chip key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>
      </Field>
      <Field label={`Label kcal per ${unit}`}>
        <Stepper value={kcal} onChange={setKcal} step={5} min={5} max={900} />
      </Field>
    </Sheet>
  );
}

export function CheckSheet({ visible, preset, onClose, onSaved }: { visible: boolean; preset: string | null; onClose: () => void; onSaved: (m: string) => void }) {
  const t = useTheme();
  const { snacks, today, refresh } = useApp();
  const day = useDay();
  const [pick, setPick] = useState<SnackPick>(null);
  const [kcal, setKcal] = useState(100);
  useEffect(() => {
    if (!visible) return;
    const s = snacks.find((x) => x.id === preset);
    setPick(s ? { id: s.id, name: s.name, cat: s.cat, unit: s.unit, kcal: s.label_kcal } : null);
  }, [visible]);
  useEffect(() => {
    if (pick?.id) setKcal(Math.round((day.info.get(pick.id)?.portion.mean ?? pick.kcal) / 5) * 5);
  }, [pick?.id]);
  const info = pick?.id ? day.info.get(pick.id) : null;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Check a portion"
      subtitle="Weigh one serving the way you really take it: grams × kcal per 100 g on the pack ÷ 100."
      footer={
        <PrimaryButton
          label="Save check"
          disabled={!pick?.id}
          onPress={async () => {
            if (!pick?.id) return;
            await addCheck(pick.id, kcal, today);
            await refresh();
            haptics.success();
            onClose();
            onSaved(`${pick.name}: ${kcal} kcal per ${pick.unit}`);
          }}
        />
      }
    >
      <Field label="Snack from your pantry">
        <SnackPicker value={pick} onChange={setPick} onlyPantry />
      </Field>
      <Field label={pick ? `Measured kcal for one ${pick.unit}` : "Measured kcal"} hint={info ? `Label says ${Math.round(info.label_kcal)}; current estimate ${Math.round(info.portion.mean)} ± ${Math.round(info.portion.sd)}.` : undefined}>
        <Stepper value={kcal} onChange={setKcal} step={5} min={5} max={900} />
      </Field>
    </Sheet>
  );
}

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.label, color: t.colors.ink }}>{label}</Text>
        <Text style={{ ...t.typography.label, color: t.colors.ink }}>{value}</Text>
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{note}</Text>
    </View>
  );
}

// Почему этот перекус в плане: ценность (вкус × убывающая отдача × окно) и осторожные калории.
export function PlanWhySheet({ item, onClose }: { item: Option | null; onClose: () => void }) {
  const t = useTheme();
  const day = useDay();
  if (!item) return null;
  const s = day.info.get(item.snack);
  if (!s) return null;
  const tk = s.taste;
  return (
    <Sheet visible onClose={onClose} title={`${s.name} × ${item.pieces}`} subtitle={`${slotLabel(item.slot)} · value ${item.value.toFixed(2)} · counts as ${Math.round(item.cautious)} kcal`}>
      <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: 16, padding: 12 }}>
        <Text style={{ ...t.typography.overline, color: t.colors.accent }}>Value</Text>
        <Row label="Worth it" value={`${tk.value.toFixed(1)} / 5`} note={tk.own !== null ? `Your ratings average ${tk.own.toFixed(1)}, pulled toward ${s.cat} (${tk.category.toFixed(1)}) until there are more.` : `No ratings yet — uses ${s.cat} snacks (${tk.category.toFixed(1)}).`} />
        <Row label="More pieces" value={`× ${item.parts.dim.toFixed(2)}`} note="Each extra piece adds 60% of the one before — the first one counts most." />
        <Row label="Craving window" value={`× ${item.parts.fit.toFixed(2)}`} note={`You usually snack ${(day.rates[item.slot]).toFixed(1)}× in ${slotLabel(item.slot)}; a snack where the craving is lands better.`} />
      </View>
      <View style={{ backgroundColor: t.colors.amberSoft, borderRadius: 16, padding: 12 }}>
        <Text style={{ ...t.typography.overline, color: t.colors.amber }}>Calories it reserves</Text>
        <Row label={`Your ${s.unit}`} value={`${Math.round(s.portion.mean)} kcal`} note={s.portion.checks > 0 ? `Label ${Math.round(s.label_kcal)}, moved by ${s.portion.checks.toFixed(1)} weighted checks.` : "Label value — no check yet."} />
        <Row label="Safety margin" value={`+ ${Math.round(day.z * s.portion.sd)} kcal`} note={`${pct(Number(useApp.getState().settings.target))} confidence × ± ${Math.round(s.portion.sd)} kcal portion spread. A check shrinks it.`} />
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink, marginTop: 6 }}>= {Math.round(item.cautious)} kcal reserved</Text>
      </View>
    </Sheet>
  );
}

export function BurstOverlay({ msg, onDone }: { msg: string | null; onDone: () => void }) {
  const t = useTheme();
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 80, elevation: 80 }}>
      <Animated.View entering={ZoomIn.duration(220)} style={{ backgroundColor: t.colors.surface, borderRadius: 24, paddingVertical: 20, paddingHorizontal: 28, alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 }}>
        <SuccessBurst visible size={72} onDone={() => setTimeout(onDone, 650)} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Cookie size={16} color={t.colors.accent} />
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>{msg}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
