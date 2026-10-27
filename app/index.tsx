import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, Cookie, Info, Plus, Repeat, Route, Scale, Settings2, ShoppingBasket, Trash2 } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { CAT_COLORS } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { useDay } from "../src/ui/derive";
import { PressableScale } from "../src/components/PressableScale";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { SwipeRow } from "../src/components/SwipeRow";
import { Stepper } from "../src/components/Bits";
import { DayDial } from "../src/components/DayDial";
import { SlotStrip } from "../src/components/Bands";
import { Sheet } from "../src/components/Sheet";
import { BurstOverlay, CheckSheet, LogSheet, NewSnackSheet } from "../src/components/Sheets";
import { deleteLog, logSnack, rateLog, setPieces } from "../src/data/repo";
import { clock, slotLabel, slotOf, SLOTS } from "../src/lib/slots";
import { dayLabel, weekdayLabel } from "../src/lib/time";
import { pct, plural } from "../src/ui/format";
import { haptics } from "../src/services/haptics";
import type { Log } from "../src/data/repo";

export default function Today() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { snacks, today, minute, settings, refresh } = useApp();
  const day = useDay();
  const [log, setLog] = useState<string | null | undefined>(undefined);
  const [check, setCheck] = useState<string | null | undefined>(undefined);
  const [newSnack, setNewSnack] = useState(false);
  const [burst, setBurst] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [why, setWhy] = useState(false);
  const [menu, setMenu] = useState<Log | null>(null);

  const fc = day.fc;
  const next = day.plan.items[0];
  const inTone = fc.pIn >= Number(settings.target) ? t.colors.pistachio : fc.pIn >= 0.5 ? t.colors.amber : t.colors.danger;
  const slotLogs = slot === null ? [] : day.todayLogs.filter((l) => slotOf(l.minute) === slot);
  const slotPlan = slot === null ? undefined : day.plan.items.find((o) => o.slot === slot);
  const empty = snacks.length === 0 && day.todayLogs.length === 0;

  const again = async (l: Log) => {
    await logSnack(l.snack_id, l.pieces, today, minute);
    await refresh();
    haptics.success();
    setBurst(`${day.name(l.snack_id)} again`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.accent }}>Snack Tally</Text>
          <Text style={{ ...t.typography.title, color: t.colors.ink }}>
            {weekdayLabel(today)}, {dayLabel(today)}
          </Text>
        </View>
        {[
          { l: "Pantry", i: <ShoppingBasket size={18} color={t.colors.ink} />, go: "/pantry" as const },
          { l: "Stats", i: <BarChart3 size={18} color={t.colors.ink} />, go: "/stats" as const },
          { l: "Settings", i: <Settings2 size={18} color={t.colors.ink} />, go: "/settings" as const },
        ].map((b) => (
          <PressableScale key={b.l} accessibilityLabel={b.l} onPress={() => router.push(b.go)} style={{ width: 40, height: 40, borderRadius: 20, marginLeft: 8, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.colors.border }}>
            {b.i}
          </PressableScale>
        ))}
      </View>

      <ScrollView stickyHeaderIndices={empty ? [] : [2]} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: t.colors.surface, borderRadius: 28, paddingVertical: 14, gap: 8 }}>
          <DayDial
            size={300}
            rates={day.rates}
            minute={minute}
            selected={slot}
            onSelect={setSlot}
            dots={day.todayLogs.map((l) => ({ minute: l.minute, kcal: l.kcal, color: CAT_COLORS[day.info.get(l.snack_id)?.cat ?? "Other"] }))}
            planned={day.plan.items.map((o) => ({ slot: o.slot, color: CAT_COLORS[day.info.get(o.snack)?.cat ?? "Other"] }))}
          >
            {slot === null ? (
              <>
                <AnimatedCounter value={fc.eatenMean} style={{ fontSize: 40, fontWeight: "800", color: t.colors.ink, padding: 0, textAlign: "center", minWidth: 120 }} />
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>of {day.budget} kcal snacks</Text>
                <Text style={{ ...t.typography.label, color: inTone, marginTop: 4 }}>{pct(fc.pIn)} stay in</Text>
              </>
            ) : (
              <>
                <Text style={{ ...t.typography.label, color: t.colors.accent }}>{slotLabel(slot)}</Text>
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, textAlign: "center" }}>usually {day.rates[slot].toFixed(1)} snacks here</Text>
                {slotLogs.map((l) => (
                  <Text key={l.id} numberOfLines={1} style={{ ...t.typography.caption, color: t.colors.ink }}>
                    • {day.name(l.snack_id)} · {Math.round(l.kcal)}
                  </Text>
                ))}
                {slotPlan ? (
                  <Text numberOfLines={1} style={{ ...t.typography.caption, color: t.colors.accent }}>
                    plan: {day.name(slotPlan.snack)} × {slotPlan.pieces}
                  </Text>
                ) : slotLogs.length === 0 ? (
                  <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>nothing here</Text>
                ) : null}
              </>
            )}
          </DayDial>
          <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Drag around the dial to look at any two hours</Text>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, paddingHorizontal: 12 }}>
            <PressableScale accessibilityLabel="Why this chance" onPress={() => setWhy(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: t.colors.surfaceAlt }}>
              <Info size={14} color={t.colors.inkMuted} />
              <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.ink }}>Likely end ~{Math.round(fc.mean)} kcal</Text>
            </PressableScale>
            <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: t.colors.accentSoft }}>
              <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.accent }}>Plan: {plural(day.plan.items.length, "snack")}</Text>
            </View>
          </View>
        </Animated.View>

        {empty ? (
          <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ margin: 16, backgroundColor: t.colors.surface, borderRadius: 22, padding: 20, gap: 12 }}>
            <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Count snacks, not grams</Text>
            {["Log a snack in pieces — a handful, a square, a cookie.", "Rate whether it was worth it; the plan learns what you enjoy.", "Weigh a portion once in a while — your handful gets its real number."].map((x, i) => (
              <Animated.View key={x} entering={FadeInDown.delay(staggerDelay(i + 2)).duration(400)} style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...t.typography.label, color: t.colors.accent }}>{i + 1}</Text>
                </View>
                <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{x}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        ) : next ? (
          <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ margin: 16, marginBottom: 0, backgroundColor: t.colors.ink, borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.typography.overline, color: t.colors.barInk, opacity: 0.7 }}>Next in your plan · {slotLabel(next.slot)}</Text>
              <Text numberOfLines={1} style={{ ...t.typography.subtitle, color: "#FFFFFF" }}>
                {day.name(next.snack)} × {next.pieces}
              </Text>
              <Text style={{ ...t.typography.caption, color: t.colors.barInk }}>~{Math.round(next.mean)} kcal · worth it {day.info.get(next.snack)?.taste.value.toFixed(1)}/5</Text>
            </View>
            <PressableScale
              accessibilityLabel="Eat it now"
              onPress={async () => {
                await logSnack(next.snack, next.pieces, today, minute);
                await refresh();
                haptics.success();
                setBurst(`${day.name(next.snack)} logged`);
              }}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: t.colors.accent }}
            >
              <Text numberOfLines={1} style={{ ...t.typography.label, color: "#FFFFFF" }}>Eat it now</Text>
            </PressableScale>
          </Animated.View>
        ) : (
          <View />
        )}

        {empty ? null : (
          <View style={{ backgroundColor: t.colors.background, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>
              Today · {plural(day.todayLogs.length, "snack")}
            </Text>
          </View>
        )}
        {empty ? null : (
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            {day.todayLogs.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, paddingHorizontal: 4 }}>Nothing yet today. Tap Snack below when you have one.</Text> : null}
            {day.todayLogs.map((l, i) => {
              const s = day.info.get(l.snack_id);
              return (
                <Animated.View key={l.id} entering={FadeInDown.delay(staggerDelay(i)).duration(400)}>
                  <SwipeRow
                    right={{ label: "Again", icon: <Repeat size={18} color="#FFFFFF" />, onTrigger: () => again(l) }}
                    left={{ label: "Delete", icon: <Trash2 size={18} color="#FFFFFF" />, onTrigger: async () => { await deleteLog(l.id, today); await refresh(); } }}
                  >
                    <PressableScale
                      accessibilityLabel={`Log ${s?.name}`}
                      onPress={() => router.push({ pathname: "/snack/[id]", params: { id: l.snack_id } })}
                      onLongPress={() => {
                        haptics.press();
                        setMenu(l);
                      }}
                      style={{ backgroundColor: t.colors.surface, borderRadius: 18, padding: 14, gap: 10 }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: CAT_COLORS[s?.cat ?? "Other"], alignItems: "center", justifyContent: "center" }}>
                          <Cookie size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink }}>
                            {s?.name} × {l.pieces}
                          </Text>
                          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                            {clock(l.minute)} · {Math.round(l.kcal)} kcal
                          </Text>
                        </View>
                        {l.rating ? (
                          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: l.rating >= 4 ? t.colors.pistachioSoft : l.rating <= 2 ? t.colors.amberSoft : t.colors.surfaceAlt }}>
                            <Text style={{ ...t.typography.label, color: l.rating >= 4 ? t.colors.pistachio : l.rating <= 2 ? t.colors.amber : t.colors.inkMuted }}>{l.rating}/5</Text>
                          </View>
                        ) : null}
                      </View>
                      {l.rating == null ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginRight: 2 }}>Worth it?</Text>
                          {[1, 2, 3, 4, 5].map((r) => (
                            <PressableScale
                              key={r}
                              accessibilityLabel={`Rate ${r}`}
                              scaleTo={0.85}
                              onPress={async () => {
                                haptics.tick();
                                await rateLog(l.id, r, today);
                                await refresh();
                              }}
                              style={{ flex: 1, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border }}
                            >
                              <Text style={{ ...t.typography.label, color: t.colors.ink }}>{r}</Text>
                            </PressableScale>
                          ))}
                        </View>
                      ) : null}
                    </PressableScale>
                  </SwipeRow>
                </Animated.View>
              );
            })}
            {day.todayLogs.length ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Swipe right to have it again · left to delete · hold to edit</Text> : null}
          </View>
        )}
      </ScrollView>

      {/* Командная панель: три действия с реальным выбором между ними. */}
      <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 14, flexDirection: "row", backgroundColor: t.colors.bar, borderRadius: 26, padding: 6, gap: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}>
        {[
          { l: "Snack", i: <Plus size={20} color="#FFFFFF" />, on: () => setLog(null), main: true },
          { l: "Plan", i: <Route size={20} color={t.colors.barInk} />, on: () => router.push("/plan"), main: false },
          { l: "Check", i: <Scale size={20} color={t.colors.barInk} />, on: () => setCheck(null), main: false },
        ].map((b) => (
          <PressableScale
            key={b.l}
            accessibilityLabel={`Bar ${b.l}`}
            onPress={() => {
              haptics.press();
              b.on();
            }}
            style={{ flex: b.main ? 1.3 : 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 20, backgroundColor: b.main ? t.colors.accent : "transparent" }}
          >
            {b.i}
            <Text style={{ ...t.typography.label, fontSize: 15, color: b.main ? "#FFFFFF" : t.colors.barInk }}>{b.l}</Text>
          </PressableScale>
        ))}
      </View>

      <LogSheet visible={log !== undefined} preset={log ?? null} onClose={() => setLog(undefined)} onSaved={setBurst} onNew={() => { setLog(undefined); setNewSnack(true); }} />
      <CheckSheet visible={check !== undefined} preset={check ?? null} onClose={() => setCheck(undefined)} onSaved={setBurst} />
      <NewSnackSheet visible={newSnack} onClose={() => setNewSnack(false)} onSaved={(m) => { setBurst(m); setLog(null); }} />
      <Sheet visible={why} onClose={() => setWhy(false)} title={`${pct(fc.pIn)} chance to stay in`} subtitle={`Budget ${day.budget} kcal${useApp.getState().flexUsed ? " incl. flex" : ""}. Likely end ${Math.round(fc.mean)} ± ${Math.round(fc.sd)} kcal.`}>
        <View style={{ gap: 6 }}>
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>Eaten so far: {Math.round(fc.eatenMean)} ± {Math.round(fc.eatenSd)} kcal</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Each snack counts at your measured portion; unchecked ones carry ±25% of the label.</Text>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>Still likely today: ~{Math.round(fc.restMean)} kcal</Text>
          <SlotStrip values={Array.from({ length: SLOTS }, (_, s) => fc.slots.find((x) => x.s === s)?.kcal ?? 0)} color={t.colors.accent} current={slotOf(minute)} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Your usual snacking per two hours (learned from past days, older days fade) × the part of each window still ahead.</Text>
        </View>
        {fc.slots.slice(0, 6).map((x) => (
          <View key={x.s} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{slotLabel(x.s)}</Text>
            <Text style={{ ...t.typography.caption, color: t.colors.ink }}>
              {x.lambda.toFixed(2)} snacks · ~{Math.round(x.kcal)} kcal
            </Text>
          </View>
        ))}
      </Sheet>
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu ? `${day.name(menu.snack_id)} at ${clock(menu.minute)}` : ""} subtitle="Edit this snack">
        {menu ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...t.typography.label, color: t.colors.ink }}>Pieces</Text>
              <Stepper
                value={menu.pieces}
                step={0.5}
                min={0.5}
                max={10}
                onChange={async (v) => {
                  await setPieces(menu.id, v);
                  await refresh();
                  setMenu({ ...menu, pieces: v, kcal: (menu.kcal / menu.pieces) * v });
                }}
              />
            </View>
            {[
              { l: "Check this portion", run: () => setCheck(menu.snack_id) },
              { l: "Open snack", run: () => router.push({ pathname: "/snack/[id]", params: { id: menu.snack_id } }) },
            ].map((a) => (
              <PressableScale key={a.l} accessibilityLabel={a.l} onPress={() => { setMenu(null); a.run(); }} style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}>
                <Text style={{ ...t.typography.body, color: t.colors.ink }}>{a.l}</Text>
              </PressableScale>
            ))}
          </>
        ) : null}
      </Sheet>
      <BurstOverlay msg={burst} onDone={() => setBurst(null)} />
    </View>
  );
}
