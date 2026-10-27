import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Archive, ArrowLeft, Cookie, Plus, Search, X } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { CATS, CAT_COLORS } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { useDay } from "../src/ui/derive";
import { goBack } from "../src/ui/nav";
import { PressableScale } from "../src/components/PressableScale";
import { SwipeRow } from "../src/components/SwipeRow";
import { Chip } from "../src/components/Bits";
import { Sheet } from "../src/components/Sheet";
import { BurstOverlay, CheckSheet, NewSnackSheet } from "../src/components/Sheets";
import { addSnack, archiveSnack, logSnack } from "../src/data/repo";
import { PRESETS } from "../src/data/presets";
import { haptics } from "../src/services/haptics";

export default function Pantry() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { snacks, logs, today, minute, refresh } = useApp();
  const day = useDay();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newSnack, setNewSnack] = useState(false);
  const [check, setCheck] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [burst, setBurst] = useState<string | null>(null);

  const query = q.trim().toLowerCase();
  const list = snacks.filter((s) => (showArchived ? s.archived === 1 : s.archived === 0) && (!cat || s.cat === cat) && (!query || s.name.toLowerCase().includes(query)));
  const groups = CATS.map((c) => ({ c, items: list.filter((s) => s.cat === c) })).filter((g) => g.items.length);
  const known = new Set(snacks.map((s) => s.name.toLowerCase()));
  const quick = PRESETS.filter((p) => !known.has(p.name.toLowerCase()) && (!cat || p.cat === cat) && (!query || p.name.toLowerCase().includes(query)));
  const count = (id: string) => logs.filter((l) => l.snack_id === id).length;

  // Липкие заголовки категорий: первый ребёнок скролла — пустой, затем пары «заголовок, строки».
  const children: React.ReactNode[] = [];
  const sticky: number[] = [];
  groups.forEach((g) => {
    sticky.push(children.length + 1);
    children.push(
      <View key={`h${g.c}`} style={{ backgroundColor: t.colors.background, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CAT_COLORS[g.c] }} />
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>
          {g.c} · {g.items.length}
        </Text>
      </View>
    );
    children.push(
      <View key={`b${g.c}`} style={{ paddingHorizontal: 16, gap: 8 }}>
        {g.items.map((s, i) => {
          const info = day.info.get(s.id);
          return (
            <Animated.View key={s.id} entering={FadeInDown.delay(staggerDelay(i)).duration(350)}>
              <SwipeRow
                right={{
                  label: "Snack now",
                  icon: <Cookie size={18} color="#FFFFFF" />,
                  onTrigger: async () => {
                    await logSnack(s.id, 1, today, minute);
                    await refresh();
                    haptics.success();
                    setBurst(`${s.name} logged`);
                  },
                }}
                left={{
                  label: s.archived ? "Restore" : "Archive",
                  icon: <Archive size={18} color="#FFFFFF" />,
                  onTrigger: async () => {
                    await archiveSnack(s.id, !s.archived);
                    await refresh();
                  },
                }}
              >
                <PressableScale
                  accessibilityLabel={`Pantry ${s.name}`}
                  onPress={() => router.push({ pathname: "/snack/[id]", params: { id: s.id } })}
                  onLongPress={() => {
                    haptics.press();
                    setMenu(s.id);
                  }}
                  style={{ backgroundColor: t.colors.surface, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink }}>{s.name}</Text>
                    <Text numberOfLines={1} style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                      {Math.round(info?.portion.mean ?? s.label_kcal)} kcal per {s.unit}
                      {info && info.portion.checks > 0 ? ` · label ${Math.round(s.label_kcal)}` : " · unchecked"} · {count(s.id)}×
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ ...t.typography.label, color: t.colors.accent }}>{info?.taste.value.toFixed(1)}</Text>
                    <Text style={{ ...t.typography.caption, fontSize: 10, color: t.colors.inkFaint }}>worth it</Text>
                  </View>
                </PressableScale>
              </SwipeRow>
            </Animated.View>
          );
        })}
      </View>
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink, flex: 1 }}>Pantry</Text>
        <PressableScale accessibilityLabel="New snack" onPress={() => setNewSnack(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: t.colors.accent }}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={{ ...t.typography.label, color: "#FFFFFF" }}>New</Text>
        </PressableScale>
      </View>
      <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.surface, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: t.colors.border }}>
          <Search size={16} color={t.colors.inkFaint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Find a snack" placeholderTextColor={t.colors.inkFaint} style={{ flex: 1, paddingVertical: 9, color: t.colors.ink, ...t.typography.body }} />
          {q ? (
            <PressableScale accessibilityLabel="Clear search" onPress={() => setQ("")}>
              <X size={16} color={t.colors.inkMuted} />
            </PressableScale>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          <Chip label="All" active={!cat} onPress={() => setCat(null)} />
          {CATS.map((c) => (
            <Chip key={c} label={c} color={CAT_COLORS[c]} active={cat === c} onPress={() => setCat(cat === c ? null : c)} />
          ))}
          <Chip label="Archived" active={showArchived} onPress={() => setShowArchived(!showArchived)} />
        </ScrollView>
      </View>
      <ScrollView stickyHeaderIndices={sticky} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View />
        {children}
        {list.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, padding: 20 }}>{showArchived ? "Nothing archived." : "No snacks match. Quick-add one below or tap New."}</Text> : null}
        {!showArchived && quick.length ? (
          <View style={{ padding: 16, gap: 8 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Quick add</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {quick.map((p) => (
                <Chip
                  key={p.name}
                  a11y={`Quick ${p.name}`}
                  label={`${p.name} · ${p.kcal}`}
                  color={CAT_COLORS[p.cat]}
                  active={false}
                  onPress={async () => {
                    await addSnack(p.name, p.cat, p.unit, p.kcal);
                    await refresh();
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}
        {list.length ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Swipe right to snack now · left to archive · hold for more</Text> : null}
      </ScrollView>
      <NewSnackSheet visible={newSnack} onClose={() => setNewSnack(false)} onSaved={setBurst} />
      <CheckSheet visible={!!check} preset={check} onClose={() => setCheck(null)} onSaved={setBurst} />
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu ? day.name(menu) : ""} subtitle="Quick actions">
        {menu
          ? [
              {
                l: "Snack one now",
                run: async () => {
                  await logSnack(menu, 1, today, minute);
                  await refresh();
                  haptics.success();
                  setBurst(`${day.name(menu)} logged`);
                },
              },
              { l: "Check the portion", run: () => setCheck(menu) },
              { l: "Open details", run: () => router.push({ pathname: "/snack/[id]", params: { id: menu } }) },
            ].map((a) => (
              <PressableScale
                key={a.l}
                accessibilityLabel={a.l}
                onPress={() => {
                  setMenu(null);
                  a.run();
                }}
                style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}
              >
                <Text style={{ ...t.typography.body, color: t.colors.ink }}>{a.l}</Text>
              </PressableScale>
            ))
          : null}
      </Sheet>
      <BurstOverlay msg={burst} onDone={() => setBurst(null)} />
    </View>
  );
}
