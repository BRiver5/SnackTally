import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { CATS, CAT_COLORS } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { useDay } from "../src/ui/derive";
import { goBack } from "../src/ui/nav";
import { PressableScale } from "../src/components/PressableScale";
import { AnimatedRing } from "../src/components/AnimatedRing";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { CategoryRing } from "../src/components/CategoryRing";
import { BarChart } from "../src/components/BarChart";
import { Heatmap } from "../src/components/Heatmap";
import { Legend } from "../src/components/Bits";
import { SlotStrip } from "../src/components/Bands";
import { EmptyState } from "../src/components/EmptyState";
import { SLOTS, slotOf } from "../src/lib/slots";
import { addDays, dayNumber } from "../src/lib/time";
import { pct, plural } from "../src/ui/format";

const DAYS = 14;
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Stats() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { logs, today, settings, minute } = useApp();
  const day = useDay();
  const [cat, setCat] = useState<string | null>(null);

  const s = useMemo(() => {
    const catOf = (id: string) => day.info.get(id)?.cat ?? "Other";
    const from = addDays(today, -(DAYS - 1));
    const recent = logs.filter((l) => l.day >= from);
    const scoped = recent.filter((l) => !cat || catOf(l.snack_id) === cat);
    const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
    const tracked = days.filter((d) => recent.some((l) => l.day === d) && d < today);
    const total = (d: string, list = recent) => list.filter((l) => l.day === d).reduce((a, l) => a + l.kcal, 0);
    const within = tracked.filter((d) => total(d) <= settings.budget).length;
    let streak = 0;
    for (let i = tracked.length - 1; i >= 0 && total(tracked[i]) <= settings.budget; i--) streak++;
    const avg = tracked.length ? tracked.reduce((a, d) => a + total(d), 0) / tracked.length : 0;
    const byCat = CATS.map((c) => ({ key: c, value: Math.round(recent.filter((l) => catOf(l.snack_id) === c).reduce((a, l) => a + l.kcal, 0)), color: CAT_COLORS[c] }));
    const bars = days.map((d) => ({ label: d === today ? "T" : String(Number(d.slice(8))), value: Math.round(total(d, scoped)) }));
    // Неделя × окно: строки — дни недели, столбцы — двухчасовые окна.
    const grid = Array.from({ length: 7 }, () => Array(SLOTS).fill(0));
    for (const l of logs.filter((x) => !cat || catOf(x.snack_id) === cat)) {
      const dow = (((dayNumber(l.day) + 3) % 7) + 7) % 7; // 1970-01-01 — четверг
      grid[dow][slotOf(l.minute)]++;
    }
    const peak = Math.max(1, ...grid.flat());
    const cells = grid.flatMap((row, r) => row.map((v, c) => ({ key: `${r}-${c}`, intensity: v / peak })));
    const snacksIn = [...day.info.values()].filter((x) => !x.archived && (!cat || x.cat === cat));
    const value = snacksIn
      .map((x) => ({ x, v: (x.taste.value - 1) / Math.max(0.2, x.portion.mean / 100) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
    const surprises = snacksIn.filter((x) => x.portion.checks > 0).sort((a, b) => Math.abs(b.portion.drift) - Math.abs(a.portion.drift)).slice(0, 5);
    return { tracked, within, streak, avg, byCat, bars, cells, value, surprises, scoped };
  }, [day, cat, today, logs, settings.budget]);

  const heat = (i: number) => (i === 0 ? t.colors.backgroundAlt : i < 0.34 ? "#DDB8E2" : i < 0.67 ? "#B067BA" : t.colors.accent);
  const maxV = Math.max(0.01, ...s.value.map((x) => x.v));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Snack stats</Text>
          <Text style={{ ...t.typography.caption, color: cat ? t.colors.accent : t.colors.inkMuted }}>{cat ? `${cat} only — tap the ring again to clear` : `Last ${DAYS} days, all kinds`}</Text>
        </View>
      </View>
      {logs.length === 0 ? (
        <EmptyState title="Nothing logged yet" description="Charts fill in as you log snacks, rate them and check portions." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}>
          <Animated.View entering={FadeInDown.duration(400)} style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: t.colors.surface, borderRadius: 20, padding: 12, alignItems: "center", gap: 2 }}>
              <AnimatedCounter value={s.avg} style={{ fontSize: 28, fontWeight: "800", color: t.colors.ink, padding: 0, textAlign: "center", minWidth: 70 }} />
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>kcal / day</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: t.colors.surface, borderRadius: 20, padding: 12, alignItems: "center", gap: 2 }}>
              <AnimatedRing progress={s.tracked.length ? s.within / s.tracked.length : 0} size={58} strokeWidth={7} color={t.colors.pistachio} trackColor={t.colors.pistachioSoft}>
                <Text style={{ ...t.typography.label, color: t.colors.ink }}>{s.tracked.length ? pct(s.within / s.tracked.length) : "—"}</Text>
              </AnimatedRing>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>days in budget</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: t.colors.surface, borderRadius: 20, padding: 12, alignItems: "center", gap: 2 }}>
              <AnimatedCounter value={s.streak} style={{ fontSize: 28, fontWeight: "800", color: t.colors.accent, padding: 0, textAlign: "center", minWidth: 50 }} />
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>day streak</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 12 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Where the calories go · tap to focus</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <CategoryRing
                segments={s.byCat}
                selected={cat}
                onSelect={setCat}
                size={150}
                center={
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{cat ? s.byCat.find((x) => x.key === cat)?.value : s.byCat.reduce((a, x) => a + x.value, 0)}</Text>
                    <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{cat ?? "kcal"}</Text>
                  </View>
                }
              />
              <View style={{ flex: 1 }}>
                <Legend rows={s.byCat.filter((x) => x.value > 0).map((x) => ({ color: x.color, label: x.key, value: String(x.value), dim: !!cat && cat !== x.key }))} />
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(2)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Snack kcal per day · budget {settings.budget}</Text>
            <BarChart data={s.bars} color={cat ? CAT_COLORS[cat] : t.colors.accent} height={110} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(3)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>When you snack</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ gap: 3 }}>
                {WEEK.map((w) => (
                  <Text key={w} style={{ ...t.typography.caption, fontSize: 10, lineHeight: 18, height: 18, color: t.colors.inkFaint }}>
                    {w}
                  </Text>
                ))}
              </View>
              <View style={{ width: SLOTS * 21 }}>
                <Heatmap cells={s.cells} colorForIntensity={heat} cellSize={18} gap={3} />
              </View>
            </View>
            <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Columns are two-hour windows from midnight; darker means more snacks there.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(4)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Most enjoyment per 100 kcal</Text>
            {s.value.map(({ x, v }) => (
              <View key={x.id} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>{x.name}</Text>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                    {x.taste.value.toFixed(1)}/5 · {Math.round(x.portion.mean)} kcal per {x.unit}
                  </Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.surfaceAlt, overflow: "hidden" }}>
                  <View style={{ width: `${(v / maxV) * 100}%`, height: 8, backgroundColor: CAT_COLORS[x.cat] }} />
                </View>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(5)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Portion surprises</Text>
            {s.surprises.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>No checked portions{cat ? ` in ${cat}` : ""} yet. Weigh one with Check.</Text> : null}
            {s.surprises.map((x) => (
              <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>
                  Your {x.name.toLowerCase()} {x.unit}
                </Text>
                <Text style={{ ...t.typography.label, color: x.portion.drift > 0 ? t.colors.amber : t.colors.pistachio }}>
                  {x.portion.drift >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(x.portion.drift * 100))}% vs label
                </Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(6)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Your learned rhythm</Text>
            <SlotStrip values={day.rates} color={t.colors.accent} current={slotOf(minute)} />
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              Snacks per two hours on a usual day, learned from {plural(new Set(logs.filter((l) => l.day < today).map((l) => l.day)).size, "past day")} — the forecast and the plan both lean on it.
            </Text>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}
