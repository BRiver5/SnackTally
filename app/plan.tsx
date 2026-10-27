import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, ArrowLeft, Heart, PiggyBank, X } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { CAT_COLORS } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { useDay } from "../src/ui/derive";
import { goBack } from "../src/ui/nav";
import { PressableScale } from "../src/components/PressableScale";
import { Segmented } from "../src/components/Segmented";
import { Chip } from "../src/components/Bits";
import { Sheet, Field } from "../src/components/Sheet";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { BurstOverlay, PlanWhySheet } from "../src/components/Sheets";
import { saveSetting } from "../src/data/repo";
import { phi } from "../src/lib/forecast";
import { bestSlotFor, PIECES, type Option, type Pin } from "../src/lib/planner";
import { comparePlans } from "../src/lib/conflicts";
import { slotLabel } from "../src/lib/slots";
import { pct, plural } from "../src/ui/format";
import { haptics } from "../src/services/haptics";

type Tab = "plan" | "whatif";

export default function PlanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { snacks, today, minute, settings, flexUsed, refresh } = useApp();
  const day = useDay();
  const [tab, setTab] = useState<Tab>("plan");
  const [why, setWhy] = useState<Option | null>(null);
  const [want, setWant] = useState<number | null>(null);
  const [wSnack, setWSnack] = useState<string | null>(null);
  const [wPieces, setWPieces] = useState(1);
  const [burst, setBurst] = useState<string | null>(null);
  const [eat, setEat] = useState<{ snack: string; pieces: number } | null>(null);
  const pantry = snacks.filter((s) => !s.archived);

  const plan = day.plan;
  const byslot = new Map(plan.items.map((o) => [o.slot, o]));
  // Шанс уложиться, если съесть ровно план: среднее и разброс порций план+съеденное.
  const planMean = day.fc.eatenMean + plan.items.reduce((s, o) => s + o.mean, 0);
  const planSd = Math.sqrt(day.fc.eatenSd ** 2 + plan.items.reduce((s, o) => s + (((day.info.get(o.snack)?.portion.sd ?? 0) * o.pieces) ** 2), 0));
  const pPlan = planSd > 0 ? phi((day.budget - planMean) / planSd) : 1;

  const savePins = async (pins: Pin[]) => {
    await saveSetting(`pins:${today}`, JSON.stringify(pins));
    await refresh();
  };

  const cmp = useMemo(() => {
    if (tab !== "whatif" || !eat) return null;
    const after = day.build({ eatNow: eat, pins: day.conflict ? [] : day.input.pins });
    const keys = (items: Option[]) => items.map((o) => `${day.name(o.snack)} × ${o.pieces} · ${slotLabel(o.slot)}`);
    return comparePlans(
      { pIn: day.fc.pIn, mean: day.fc.mean, planValue: plan.value, planItems: plan.items.length, keys: keys(plan.items) },
      { pIn: after.fc.pIn, mean: after.fc.mean, planValue: after.plan.value, planItems: after.plan.items.length, keys: keys(after.plan.items) }
    );
  }, [tab, eat, day]);

  const col = (label: string, a: string, b: string, better: boolean | null) => (
    <View key={label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, borderTopWidth: 1, borderTopColor: t.colors.border }}>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, flex: 1.3 }}>{label}</Text>
      <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1, textAlign: "center" }}>{a}</Text>
      <Text style={{ ...t.typography.label, flex: 1, textAlign: "center", color: better === null ? t.colors.ink : better ? t.colors.pistachio : t.colors.danger }}>{b}</Text>
    </View>
  );

  const c = day.conflict;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Rest of today</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {Math.max(0, Math.round(day.cap))} kcal of cautious room · aim {pct(Number(settings.target))} sure
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Segmented items={[{ key: "plan" as Tab, label: "Plan", badge: c ? 1 : undefined }, { key: "whatif" as Tab, label: "What if" }]} value={tab} onChange={setTab} />
      </View>

      {tab === "plan" ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: insets.bottom + 100 }}>
          <Animated.View entering={FadeInDown.duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, flexDirection: "row" }}>
            {[
              [String(plan.items.length), "snacks planned"],
              [plan.value.toFixed(1), "enjoyment"],
              [pct(pPlan), "stay in if kept"],
            ].map(([a, b]) => (
              <View key={b} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 26, fontWeight: "800", color: t.colors.ink }}>{a}</Text>
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{b}</Text>
              </View>
            ))}
          </Animated.View>

          {c ? (
            <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 8, borderWidth: 1.5, borderColor: t.colors.amber }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} color={t.colors.amber} />
                <Text style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink, flex: 1 }}>
                  {day.name(c.pin.snack)} × {c.pin.pieces} doesn't fit {slotLabel(c.pin.slot)}
                </Text>
                <PressableScale accessibilityLabel="Drop the wish" onPress={() => savePins(day.input.pins.filter((p) => p !== c.pin && !(p.slot === c.pin.slot && p.snack === c.pin.snack)))}>
                  <X size={16} color={t.colors.inkMuted} />
                </PressableScale>
              </View>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                It reserves {Math.round(c.need)} kcal ({Math.round(c.need - c.margin)} + {Math.round(c.margin)} safety margin for an uncertain portion), but only {Math.max(0, Math.round(c.cap))} kcal of cautious room is left — {Math.round(c.shortfall)} short.
              </Text>
              {c.alternatives.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.danger }}>No version of it fits today. Drop the wish or save it for tomorrow.</Text> : null}
              {c.alternatives.map((a, k) => (
                <View key={a.label} style={{ backgroundColor: t.colors.surfaceAlt, borderRadius: 14, padding: 10, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>
                      {k + 1}. {a.label}
                    </Text>
                    <Text style={{ ...t.typography.label, color: a.plan.value >= plan.value ? t.colors.pistachio : t.colors.inkMuted }}>{a.plan.value.toFixed(1)}</Text>
                  </View>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                    {a.detail} Day enjoyment {a.plan.value.toFixed(1)} vs {plan.value.toFixed(1)} now.
                  </Text>
                  {a.kind !== "check" ? (
                    <PressableScale
                      accessibilityLabel={`Use ${a.label}`}
                      onPress={async () => {
                        haptics.tap();
                        if (a.flex) await saveSetting(`flex:${today}`, String(flexUsed + a.flex));
                        await savePins([...day.input.pins.filter((p) => p.slot !== c.pin.slot), a.pin]);
                      }}
                      style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.colors.accentSoft }}
                    >
                      <Text style={{ ...t.typography.label, color: t.colors.accent }}>Use this</Text>
                    </PressableScale>
                  ) : (
                    <Text style={{ ...t.typography.caption, color: t.colors.accent }}>Tap Check on the home bar, then come back.</Text>
                  )}
                </View>
              ))}
            </Animated.View>
          ) : null}

          {day.bank > 0 || flexUsed > 0 ? (
            <Animated.View entering={FadeInDown.delay(staggerDelay(2)).duration(400)} style={{ backgroundColor: t.colors.pistachioSoft, borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PiggyBank size={20} color={t.colors.pistachio} />
              <Text style={{ ...t.typography.caption, color: t.colors.ink, flex: 1 }}>
                Week flex: {Math.round(day.bank)} kcal banked from lighter days{flexUsed ? ` · ${flexUsed} added today` : ""}.
              </Text>
              {day.bank >= 50 ? (
                <PressableScale
                  accessibilityLabel="Add 50 kcal"
                  onPress={async () => {
                    await saveSetting(`flex:${today}`, String(flexUsed + 50));
                    await refresh();
                  }}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: t.colors.pistachio }}
                >
                  <Text style={{ ...t.typography.label, color: "#FFFFFF" }}>+50</Text>
                </PressableScale>
              ) : null}
            </Animated.View>
          ) : null}

          {plan.slots.length === 0 ? (
            <View style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 18 }}>
              <Text style={{ ...t.typography.body, color: t.colors.ink }}>The day is done — the plan stops at 10pm. See you tomorrow.</Text>
            </View>
          ) : null}
          {pantry.length === 0 ? (
            <View style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 18 }}>
              <Text style={{ ...t.typography.body, color: t.colors.ink }}>Add snacks to your pantry first — the plan picks from them.</Text>
            </View>
          ) : null}

          {/* Таймлайн оставшихся окон: план, свободные окна и закреплённые желания. */}
          <View>
            {plan.slots.map((s, i) => {
              const o = byslot.get(s);
              const pinned = !!o && day.input.pins.some((p) => p.slot === s && p.snack === o.snack);
              const sn = o ? day.info.get(o.snack) : null;
              return (
                <Animated.View key={s} entering={FadeInDown.delay(staggerDelay(i + 2, 50)).duration(350)} style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ width: 64, alignItems: "flex-end", paddingTop: 14 }}>
                    <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{slotLabel(s).split("–")[0]}</Text>
                  </View>
                  <View style={{ alignItems: "center", width: 14 }}>
                    <View style={{ width: 2, flex: 1, backgroundColor: i === 0 ? "transparent" : t.colors.border }} />
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: o ? CAT_COLORS[sn?.cat ?? "Other"] : t.colors.surface, borderWidth: 2, borderColor: o ? t.colors.surface : t.colors.border }} />
                    <View style={{ width: 2, flex: 1, backgroundColor: i === plan.slots.length - 1 ? "transparent" : t.colors.border }} />
                  </View>
                  <PressableScale
                    accessibilityLabel={o ? `Planned ${sn?.name}` : `Free ${slotLabel(s)}`}
                    onPress={() => (o ? setWhy(o) : (setWant(s), setWSnack(null), setWPieces(1)))}
                    onLongPress={() => {
                      haptics.press();
                      setWant(s);
                      setWSnack(o?.snack ?? null);
                      setWPieces(o?.pieces ?? 1);
                    }}
                    style={{ flex: 1, marginVertical: 5, borderRadius: 16, padding: 12, backgroundColor: o ? t.colors.surface : "transparent", borderWidth: o ? 0 : 1.5, borderStyle: o ? "solid" : "dashed", borderColor: t.colors.border }}
                  >
                    {o && sn ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink }}>
                            {sn.name} × {o.pieces}
                          </Text>
                          <Text numberOfLines={1} style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                            ~{Math.round(o.mean)} kcal · reserves {Math.round(o.cautious)} · worth {sn.taste.value.toFixed(1)}
                          </Text>
                        </View>
                        {pinned ? <Heart size={16} color={t.colors.accent} fill={t.colors.accent} /> : null}
                      </View>
                    ) : (
                      <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Free · usually {day.rates[s].toFixed(1)} snacks here · tap to want something</Text>
                    )}
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
          {plan.items.length ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Tap a snack to see why · hold any window to want something there</Text> : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: insets.bottom + 40 }}>
          <Animated.View entering={FadeInDown.duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>If I eat this now</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {pantry.map((s) => (
                <Chip key={s.id} a11y={`Eat ${s.name}`} label={s.name} color={CAT_COLORS[s.cat]} active={eat?.snack === s.id} onPress={() => setEat(eat?.snack === s.id ? null : { snack: s.id, pieces: eat?.pieces ?? 1 })} />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {PIECES.map((k) => (
                <Chip key={k} label={k === 0.5 ? "Half" : `× ${k}`} active={(eat?.pieces ?? 1) === k} onPress={() => eat && setEat({ ...eat, pieces: k })} />
              ))}
            </View>
          </Animated.View>
          {cmp ? (
            <>
              <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16 }}>
                <View style={{ flexDirection: "row", paddingBottom: 6 }}>
                  <Text style={{ flex: 1.3 }} />
                  <Text style={{ ...t.typography.overline, color: t.colors.inkMuted, flex: 1, textAlign: "center" }}>Now</Text>
                  <Text style={{ ...t.typography.overline, color: t.colors.accent, flex: 1, textAlign: "center" }}>If eaten</Text>
                </View>
                {col("Chance to stay in", pct(cmp.before.pIn), pct(cmp.after.pIn), Math.abs(cmp.after.pIn - cmp.before.pIn) < 0.005 ? null : cmp.after.pIn > cmp.before.pIn)}
                {col("Likely end of day", `${Math.round(cmp.before.mean)}`, `${Math.round(cmp.after.mean)}`, null)}
                {col("Rest-of-day plan", plural(cmp.before.planItems, "snack"), plural(cmp.after.planItems, "snack"), cmp.after.planItems === cmp.before.planItems ? null : cmp.after.planItems > cmp.before.planItems)}
                {col("Plan enjoyment", cmp.before.planValue.toFixed(1), cmp.after.planValue.toFixed(1), Math.abs(cmp.after.planValue - cmp.before.planValue) < 0.05 ? null : cmp.after.planValue > cmp.before.planValue)}
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(staggerDelay(2)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 6 }}>
                {cmp.dropped.length === 0 && cmp.added.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>The rest of the plan stays the same.</Text> : null}
                {cmp.dropped.map((k) => (
                  <Text key={`d${k}`} style={{ ...t.typography.caption, color: t.colors.danger }}>
                    − {k}
                  </Text>
                ))}
                {cmp.added.map((k) => (
                  <Text key={`a${k}`} style={{ ...t.typography.caption, color: t.colors.pistachio }}>
                    + {k}
                  </Text>
                ))}
              </Animated.View>
            </>
          ) : (
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, textAlign: "center" }}>Pick a snack to compare the rest of the day before and after.</Text>
          )}
        </ScrollView>
      )}

      {tab === "plan" && pantry.length > 0 && plan.slots.length > 0 ? (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 14 }}>
          <PressableScale
            accessibilityLabel="I want something"
            onPress={() => {
              setWant(bestSlotFor(minute, day.rates));
              setWSnack(null);
              setWPieces(1);
            }}
            style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 15, borderRadius: 999, backgroundColor: t.colors.accent }}
          >
            <Heart size={18} color="#FFFFFF" />
            <Text style={{ ...t.typography.subtitle, color: "#FFFFFF" }}>I want something</Text>
          </PressableScale>
        </View>
      ) : null}

      <PlanWhySheet item={why} onClose={() => setWhy(null)} />
      <Sheet
        visible={want !== null}
        onClose={() => setWant(null)}
        title="I want…"
        subtitle="The plan keeps it and rearranges the rest — or tells you why it can't."
        footer={
          <PrimaryButton
            label="Keep it in the plan"
            disabled={!wSnack || want === null}
            onPress={async () => {
              if (!wSnack || want === null) return;
              await savePins([...day.input.pins.filter((p) => p.slot !== want), { snack: wSnack, slot: want, pieces: wPieces }]);
              haptics.success();
              setWant(null);
              setBurst(`${day.name(wSnack)} kept for ${slotLabel(want)}`);
            }}
          />
        }
      >
        <Field label="Snack">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {pantry.map((s) => (
              <Chip key={s.id} a11y={`Want ${s.name}`} label={s.name} color={CAT_COLORS[s.cat]} active={wSnack === s.id} onPress={() => setWSnack(s.id)} />
            ))}
          </View>
        </Field>
        <Field label="How many">
          <View style={{ flexDirection: "row", gap: 8 }}>
            {PIECES.map((k) => (
              <Chip key={k} label={k === 0.5 ? "Half" : `× ${k}`} active={wPieces === k} onPress={() => setWPieces(k)} />
            ))}
          </View>
        </Field>
        <Field label="When">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {plan.slots.map((s) => (
              <Chip key={s} label={slotLabel(s)} active={want === s} onPress={() => setWant(s)} />
            ))}
          </View>
        </Field>
      </Sheet>
      <BurstOverlay msg={burst} onDone={() => setBurst(null)} />
    </View>
  );
}
