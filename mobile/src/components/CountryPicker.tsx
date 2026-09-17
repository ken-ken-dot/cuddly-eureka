import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "../theme";
import { RADII, SPACING, TYPE } from "../theme/tokens";

export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

/** ISO country list with dial codes — curated for VUGA's target markets. */
export const COUNTRIES: Country[] = [
  { code: "RW", name: "Rwanda", dialCode: "+250", flag: "🇷🇼" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "UG", name: "Uganda", dialCode: "+256", flag: "🇺🇬" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "TZ", name: "Tanzania", dialCode: "+255", flag: "🇹🇿" },
  { code: "CD", name: "DR Congo", dialCode: "+243", flag: "🇨🇩" },
  { code: "BI", name: "Burundi", dialCode: "+257", flag: "🇧🇮" },
  { code: "SS", name: "South Sudan", dialCode: "+211", flag: "🇸🇸" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "ET", name: "Ethiopia", dialCode: "+251", flag: "🇪🇹" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
].sort((a, b) => a.name.localeCompare(b.name));

interface CountryPickerProps {
  value: Country | null;
  onSelect: (country: Country) => void;
  placeholder?: string;
}

export function CountryPicker({ value, onSelect, placeholder = "Country" }: CountryPickerProps) {
  const { tokens: t } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.dialCode.includes(q),
    );
  }, [search]);

  const display = value ? `${value.flag} ${value.name}` : placeholder;

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
          setSearch("");
        }}
        style={[
          styles.trigger,
          {
            backgroundColor: t.surface3,
            borderColor: value ? t.ochre : t.line,
          },
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            { color: value ? t.ink : t.inkDim },
          ]}
        >
          {display}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: t.surface2 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search countries..."
              placeholderTextColor={t.inkDim}
              autoCorrect={false}
              style={[
                styles.searchInput,
                {
                  backgroundColor: t.surface3,
                  borderColor: t.line,
                  color: t.ink,
                },
              ]}
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  style={[
                    styles.row,
                    value?.code === item.code && {
                      backgroundColor: t.surface3,
                    },
                  ]}
                >
                  <Text style={[styles.flag, { color: t.ink }]}>{item.flag}</Text>
                  <Text style={[styles.countryName, { color: t.ink }]}>{item.name}</Text>
                  <Text style={[styles.dialCode, { color: t.inkDim }]}>{item.dialCode}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Look up a country by ISO code. */
export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

const styles = StyleSheet.create({
  trigger: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.s,
    paddingVertical: 12,
  },
  triggerText: {
    fontSize: TYPE.body,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: RADII.card,
    borderTopRightRadius: RADII.card,
    maxHeight: "70%",
    paddingBottom: SPACING.l,
  },
  searchInput: {
    margin: SPACING.m,
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.s,
    paddingVertical: 10,
    fontSize: TYPE.body,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: 12,
    gap: SPACING.s,
  },
  flag: { fontSize: 20 },
  countryName: { flex: 1, fontSize: TYPE.body },
  dialCode: { fontSize: TYPE.small, fontWeight: "600" },
});
