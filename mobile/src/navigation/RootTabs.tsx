import React from "react";
import { StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import type { LinkingOptions } from "@react-navigation/native";

import { useTheme } from "../theme";
import { EASE, MOTION, TYPE } from "../theme/tokens";
import { PhosphorIcon } from "../components/PhosphorIcon";
import {
  ArrowsLeftRight,
  BookOpen,
  UserCircle,
} from "phosphor-react-native";
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

/**
 * The design brief's tab transition: a cross-fade with a small vertical slide —
 * ease-out, no bounce. Falls back to the built-in fade if the interpolator
 * signature ever changes.
 */
type SceneStyleInterpolator = NonNullable<
  BottomTabNavigationOptions["sceneStyleInterpolator"]
>;

const fadeSlide: SceneStyleInterpolator = ({ current }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 1, 0],
    }),
    transform: [
      {
        translateY: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [6, 0, 6],
        }),
      },
    ],
  },
});

interface TabDef {
  label: string;
  /** Phosphor regular outline at rest, fill when active. */
  Icon: typeof ArrowsLeftRight;
  accessibilityLabel: (keptCount: number) => string;
}

const TABS: Record<"Translate" | "Learn" | "Profile", TabDef> = {
  Translate: {
    label: "TRANSLATE",
    Icon: ArrowsLeftRight,
    accessibilityLabel: () => "Translate tab",
  },
  Learn: {
    label: "LEARN",
    Icon: BookOpen,
    accessibilityLabel: (n) =>
      `Learn tab, ${n} kept correction${n === 1 ? "" : "s"}`,
  },
  Profile: {
    label: "PROFILE",
    Icon: UserCircle,
    accessibilityLabel: () => "Profile tab",
  },
};

/** Nav icon: one icon family, outline at rest, filled when active. */
function TabIcon({
  icon,
  color,
  focused,
}: {
  icon: TabDef["Icon"];
  color: string;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      <PhosphorIcon icon={icon} size={22} color={color} weight={focused ? "fill" : "regular"} />
    </View>
  );
}

const linking: LinkingOptions<RootTabParamList> = {
  prefixes: ["vuga://", "https://vuga.app"],
  config: {
    screens: {
      Translate: "",
      Learn: "learn",
      Profile: "profile",
    },
  },
};

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
    <NavigationContainer theme={navTheme} linking={linking}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          animation: "fade",
          sceneStyleInterpolator: fadeSlide,
          transitionSpec: {
            animation: "timing",
            config: { duration: MOTION.base, easing: EASE.out },
          },
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
            tabBarLabel: TABS.Translate.label,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={TABS.Translate.Icon} color={color} focused={focused} />
            ),
            tabBarAccessibilityLabel: TABS.Translate.accessibilityLabel(0),
          }}
        />
        <Tab.Screen
          name="Learn"
          component={LearnScreen}
          options={{
            tabBarLabel: TABS.Learn.label,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={TABS.Learn.Icon} color={color} focused={focused} />
            ),
            tabBarAccessibilityLabel: TABS.Learn.accessibilityLabel(keptCount),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: TABS.Profile.label,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={TABS.Profile.Icon} color={color} focused={focused} />
            ),
            tabBarAccessibilityLabel: TABS.Profile.accessibilityLabel(0),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center", height: 26 },
});
