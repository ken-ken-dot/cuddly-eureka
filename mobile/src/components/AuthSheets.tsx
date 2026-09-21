import React from "react";
import { Modal, StyleSheet, View } from "react-native";

import { SignupScreen } from "../screens/SignupScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { useAccount } from "../store/account";

/**
 * Presents the signup/login screens as an opt-in sheet ABOVE the running app.
 * Replaces the old AuthGate: nothing here gates the app (brief Section 0) —
 * RootTabs stays mounted underneath, so Translate/Learn state (including the
 * Learn tab's local history) is untouched by signing in or out.
 *
 * Intent comes from the account store (Profile's Sign up / Log in buttons),
 * and both auth screens call closeAuthSheet via their onDismiss ("Not now").
 */
export function AuthSheets() {
  const sheet = useAccount((s) => s.authSheet);
  const close = useAccount((s) => s.closeAuthSheet);

  return (
    <Modal visible={sheet !== null} animationType="slide" onRequestClose={close}>
      <View style={styles.flex}>
        {sheet === "login" ? (
          <LoginScreen onSwitchToSignup={() => useAccount.setState({ authSheet: "signup" })} onDismiss={close} />
        ) : (
          <SignupScreen onSwitchToLogin={() => useAccount.setState({ authSheet: "login" })} onDismiss={close} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
