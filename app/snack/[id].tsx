import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Cookie, Scale } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { CAT_COLORS } from "../../src/theme/colors";
import { staggerDelay } from "../../src/theme/motion";
import { useApp } from "../../src/store/appStore";
import { useDay } from "../../src/ui/derive";
import { goBack } from "../../src/ui/nav";
import { PressableScale } from "../../src/components/PressableScale";
import { AnimatedRing } from "../../src/components/AnimatedRing";
import { BarChart } from "../../src/components/BarChart";
import { Stepper } from "../../src/components/Bits";
import { PortionBand, SlotStrip } from "../../src/components/Bands";
import { BurstOverlay, CheckSheet } from "../../src/components/Sheets";
import { logSnack, updateSnackLabel } from "../../src/data/repo";
import { SLOTS, slotOf } from "../../src/lib/slots";
import { addDays, dayLabel } from "../../src/lib/time";
import { plural, qty } from "../../src/ui/format";
import { haptics } from "../../src/services/haptics";

export default function SnackScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { logs, checks, today, minute, refresh } = useApp();
  const day = useDay();
  const [check, setCheck] = useState(false);
  const [burst, setBurst] = useState<string | null>(null);
  const s = day.info.get(id ?? "");
  if (!s) return null;

  const mine = logs.filter((l) => l.snack_id === s.id);
  const myChecks = checks.filter((c) => c.snack_id === s.id);
  const bySlot = Array.from({ length: SLOTS }, (_, k) => mine.filter((l) => slotOf(l.minute) === k).length);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const bars = days.map((d) => ({ label: i2(d), value: Math.round(mine.filter((l) => l.day === d).reduce((a, l) => a + l.kcal, 0)) }));
  const ratings = [1, 2, 3, 4, 5].map((r) => mine.filter((l) => l.rating === r).length);
  const maxR = Math.max(1, ...ratings);
  const unitCautious = s.portion.mean + day.z * s.portion.sd;
  const fits = Math.max(0, Math.floor((day.cap / unitCautious) * 2) / 2);
  function i2(d: string) {
    return d === today ? "T" : String(Number(d.slice(8)));
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: CAT_COLORS[s.cat] ?? CAT_COLORS.Other, alignItems: "center", justifyContent: "center" }}>
          <Cookie size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ ...t.typography.subtitle, color: t.colors.ink }}>{s.name}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {s.cat} · counted per {s.unit} · {plural(mine.length, "time")}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 110 }}>
        <Animated.View entering={FadeInDown.duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 12 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>What your {s.unit} really is</Text>
          <PortionBand label={s.label_kcal} mean={s.portion.mean} sd={s.portion.sd} checks={myChecks.map((c) => c.kcal)} unit={s.unit} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {s.portion.checks > 0
              ? `${s.portion.drift >= 0 ? "+" : "−"}${Math.abs(Math.round(s.portion.drift * 100))}% vs the label, from ${s.portion.checks.toFixed(1)} weighted checks (older checks fade).`
              : "No checks yet — the label is used with a ±25% safety spread."}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>Label kcal</Text>
            <Stepper
              value={s.label_kcal}
              step={5}
              min={5}
              max={900}
              onChange={async (v) => {
                await updateSnackLabel(s.id, v);
                await refresh();
              }}
            />
          </View>
          {myChecks.slice(0, 4).map((c) => (
            <Text key={c.id} style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              Checked {dayLabel(c.day)}: {Math.round(c.kcal)} kcal
            </Text>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, flexDirection: "row", gap: 16, alignItems: "center" }}>
          <AnimatedRing progress={(s.taste.value - 1) / 4} size={92} strokeWidth={10} color={t.colors.accent} trackColor={t.colors.accentSoft}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: t.colors.ink }}>{s.taste.value.toFixed(1)}</Text>
            <Text style={{ fontSize: 9, fontWeight: "700", color: t.colors.inkMuted }}>WORTH IT</Text>
          </AnimatedRing>
          <View style={{ flex: 1, gap: 6 }}>
            {[5, 4, 3, 2, 1].map((r) => (
              <View key={r} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, width: 10 }}>{r}</Text>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceAlt, overflow: "hidden" }}>
                  <View style={{ width: `${(ratings[r - 1] / maxR) * 100}%`, height: 6, backgroundColor: r >= 4 ? t.colors.pistachio : r <= 2 ? t.colors.amber : t.colors.inkFaint }} />
                </View>
              </View>
            ))}
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              {s.taste.own !== null ? `Own ${s.taste.own.toFixed(1)} · ${s.cat} ${s.taste.category.toFixed(1)}` : `Unrated — leans on ${s.cat} (${s.taste.category.toFixed(1)})`}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(staggerDelay(2)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>When you have it</Text>
          {mine.length ? <SlotStrip values={bySlot} color={CAT_COLORS[s.cat] ?? t.colors.accent} current={slotOf(minute)} /> : <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Not logged yet.</Text>}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(staggerDelay(3)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Last 14 days · kcal</Text>
          <BarChart data={bars} color={CAT_COLORS[s.cat] ?? t.colors.accent} height={90} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(staggerDelay(4)).duration(400)} style={{ backgroundColor: fits >= 1 ? t.colors.pistachioSoft : t.colors.amberSoft, borderRadius: 22, padding: 16, gap: 4 }}>
          <Text style={{ ...t.typography.label, color: fits >= 1 ? t.colors.pistachio : t.colors.amber }}>{fits >= 0.5 ? `Room for ${qty(fits, s.unit)} today` : "No room left today"}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.ink }}>
            Each {s.unit} reserves {Math.round(unitCautious)} kcal: {Math.round(s.portion.mean)} plus a {Math.round(day.z * s.portion.sd)} kcal margin for portion spread. {Math.max(0, Math.round(day.cap))} kcal of cautious room is left.
          </Text>
        </Animated.View>
      </ScrollView>

      <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 14, flexDirection: "row", gap: 10 }}>
        <PressableScale
          accessibilityLabel="Snack now"
          onPress={async () => {
            await logSnack(s.id, 1, today, minute);
            await refresh();
            haptics.success();
            setBurst(`${s.name} logged`);
          }}
          style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 999, backgroundColor: t.colors.accent }}
        >
          <Cookie size={18} color="#FFFFFF" />
          <Text style={{ ...t.typography.label, fontSize: 15, color: "#FFFFFF" }}>Snack one now</Text>
        </PressableScale>
        <PressableScale accessibilityLabel="Check portion" onPress={() => setCheck(true)} style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 999, backgroundColor: t.colors.bar }}>
          <Scale size={18} color="#FFFFFF" />
          <Text style={{ ...t.typography.label, fontSize: 15, color: "#FFFFFF" }}>Check portion</Text>
        </PressableScale>
      </View>
      <CheckSheet visible={check} preset={s.id} onClose={() => setCheck(false)} onSaved={setBurst} />
      <BurstOverlay msg={burst} onDone={() => setBurst(null)} />
    </View>
  );
}
