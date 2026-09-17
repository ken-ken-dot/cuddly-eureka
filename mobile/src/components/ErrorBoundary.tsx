import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";

import { DARK } from "../theme/tokens";
import { Logo } from "./Logo";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary — catches any uncaught render error and shows a
 * branded recovery screen instead of the blank white screen that React
 * Native defaults to in production. Without this, a single throw anywhere
 * in the tree kills the entire app silently.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production you'd pipe this to Sentry / Crashlytics. For now, log
    // so it's visible in the Expo dev console.
    console.error("[VUGA] Render error:", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      return (
        <View style={[styles.container, { backgroundColor: DARK.surface }]}>
          <Logo size={36} ochre={DARK.ochre} rust={DARK.rust} />
          <Text style={[styles.title, { color: DARK.ink }]}>
            Something went wrong
          </Text>
          <Text style={[styles.body, { color: DARK.inkDim }]}>
            {this.state.error.message?.slice(0, 200) || "An unexpected error occurred."}
          </Text>
          <Pressable
            onPress={this.handleRetry}
            style={[styles.button, { backgroundColor: DARK.ochre }]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading the app"
          >
            <Text style={[styles.buttonText, { color: DARK.surface }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
