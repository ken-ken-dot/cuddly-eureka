import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";

import { useTheme } from "../theme";
import { SPACING, TYPE } from "../theme/tokens";
import { TranslateScreen } from "../screens/TranslateScreen";
import { LearnScreen } from "../screens/LearnScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { useCorrections } from "../store/corrections";

export type RootTabParamList = {
  Translate: undefined;
  Learn: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

function TabIcon({
  glyph,
  color,
  focused,
}: {
  glyph: string;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 7,
          borderRightWidth: 7,
          borderBottomWidth: 12,
          borderBottomColor: focused ? color : "transparent",
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          opacity: focused ? 1 : 0.45,
        }}
      />
      <Text style={[styles.iconGlyph, { color }]}>{glyph}</Text>
    </View>
  );
}

export function RootTabs() {
  const { tokens: t } = useTheme();
  const keptCount = useCorrections((s) => s.corrections.length);

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: t.surface,
      card: t.surface2,
      text: t.ink,
      border: t.line,
      primary: t.ochre,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.ochre,
          tabBarInactiveTintColor: t.inkDim,
          tabBarStyle: {
            backgroundColor: t.surface2,
            borderTopColor: t.line,
          },
          tabBarLabelStyle: {
            fontSize: TYPE.tiny,
            fontWeight: "700",
            letterSpacing: 0.5,
          },
        }}
      >
        <Tab.Screen
          name="Translate"
          component={TranslateScreen}
          options={{
            tabBarLabel: "TRANSLATE",
            tabBarIcon: ({ color, focused }) => <TabIcon glyph="⇄" color={color} focused={focused} />,
            tabBarAccessibilityLabel: "Translate tab",
          }}
        />
        <Tab.Screen
          name="Learn"
          component={LearnScreen}
          options={{
            tabBarLabel: keptCount > 0 ? `LEARN (${keptCount})` : "LEARN",
            tabBarIcon: ({ color, focused }) => <TabIcon glyph="✓" color={color} focused={focused} />,
            tabBarAccessibilityLabel: `Learn tab, ${keptCount} kept correction${keptCount === 1 ? "" : "s"}`,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: "PROFILE",
            tabBarIcon: ({ color, focused }) => <TabIcon glyph="◉" color={color} focused={focused} />,
            tabBarAccessibilityLabel: "Profile tab",
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center", height: 26, gap: 2 },
  iconGlyph: { fontSize: 10, fontWeight: "800" },
});
