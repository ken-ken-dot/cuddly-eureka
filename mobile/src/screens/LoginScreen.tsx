import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { RADII, SPACING, TRACKING, TYPE } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { Logo } from "../components/Logo";
import { AuthBackgroundIcons } from "../components/AuthBackgroundIcons";
import { useAccount } from "../store/account";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface FieldErrors {
  email?: string;
  password?: string;
}

function validateField(name: keyof FieldErrors, value: string): string | undefined {
  switch (name) {
    case "email":
      if (!value.trim()) return "Email address is required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Enter a valid email address.";
      return undefined;
    case "password":
      if (!value) return "Password is required.";
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

interface LoginScreenProps {
  onSwitchToSignup: () => void;
  onDismiss: () => void;
}

export function LoginScreen({ onSwitchToSignup, onDismiss }: LoginScreenProps) {
  const { tokens: t } = useTheme();
  const { login, loading, error, clearError } = useAccount();

  /** Visual family of the error banner, by error class:
   *  rust for user-fixable (credentials/validation), ochre for setup/config
   *  issues, dim for network/server faults. */
  const errorTone: "rust" | "ochre" | "dim" =
    error?.kind === "AUTH_NOT_CONFIGURED"
      ? "ochre"
      : error?.kind === "NETWORK" || error?.kind === "TIMEOUT" || error?.kind === "SERVER"
        ? "dim"
        : "rust";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [shakeAnim] = useState(() => new Animated.Value(0));

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleBlur = useCallback(
    (name: keyof FieldErrors) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      const value = name === "password" ? password : email;
      const err = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: err }));
    },
    [email, password],
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: FieldErrors = {
      email: validateField("email", email),
      password: validateField("password", password),
    };
    setErrors(newErrors);
    setTouched({ email: true, password: true });
    const hasError = Object.values(newErrors).some(Boolean);
    if (hasError) triggerShake();
    return !hasError;
  }, [email, password, triggerShake]);

  const handleLogin = useCallback(async () => {
    clearError();
    if (!validateAll()) return;
    const ok = await login(email.trim().toLowerCase(), password);
    if (ok) onDismiss();
  }, [email, password, login, clearError, validateAll, onDismiss]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]} edges={["bottom"]}>
      {/* Decorative background glyphs — non-interactive, behind everything. */}
      <AuthBackgroundIcons />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Logo size={40} ochre={t.ochre} rust={t.rust} />
            <Text style={[styles.title, { color: t.ink }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: t.inkDim }]}>
              Back up your history and take it with you
            </Text>
          </View>

          {/* Error banner — tone reflects the failure family (see errorTone). */}
          {error && (
            <View
              style={[
                styles.errorBanner,
                errorTone === "rust" && { backgroundColor: t.rustSoft, borderColor: t.rust },
                errorTone === "ochre" && { backgroundColor: t.card, borderColor: t.ochre },
                errorTone === "dim" && { backgroundColor: t.surface2, borderColor: t.line },
              ]}
            >
              <Text
                style={[
                  styles.errorText,
                  errorTone === "rust" && { color: t.rust },
                  errorTone === "ochre" && { color: t.ochre },
                  errorTone === "dim" && { color: t.inkDim },
                ]}
              >
                {error.message}
              </Text>
              {error.kind === "INVALID_CREDENTIALS" && (
                <Pressable onPress={onSwitchToSignup}>
                  <Text style={[styles.errorLink, { color: t.ochre }]}>Sign up instead</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Form */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: t.inkDim }]}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onBlur={() => handleBlur("email")}
                placeholder="Email address"
                placeholderTextColor={t.inkDim}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  {
                    backgroundColor: t.surface3,
                    borderColor: touched.email && errors.email ? t.rust : t.line,
                    color: t.ink,
                  },
                ]}
              />
              {touched.email && errors.email && (
                <Text style={[styles.fieldError, { color: t.rust }]}>{errors.email}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: t.inkDim }]}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => handleBlur("password")}
                  placeholder="Password"
                  placeholderTextColor={t.inkDim}
                  secureTextEntry={!showPassword}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: t.surface3,
                      borderColor: touched.password && errors.password ? t.rust : t.line,
                      color: t.ink,
                    },
                  ]}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.showToggle}
                >
                  <Text style={[styles.showToggleText, { color: t.ochre }]}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
              {touched.password && errors.password && (
                <Text style={[styles.fieldError, { color: t.rust }]}>{errors.password}</Text>
              )}
            </View>
          </Animated.View>

          {/* Submit */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={[
              styles.submitButton,
              {
                backgroundColor: loading ? t.surface3 : t.ochre,
                ...elevate("float", t),
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={t.ink} size="small" />
            ) : (
              <Text style={[styles.submitText, { color: t.surface }]}>Log in</Text>
            )}
          </Pressable>

          {/* Switch to signup */}
          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: t.inkDim }]}>Don't have an account? </Text>
            <Pressable onPress={onSwitchToSignup}>
              <Text style={[styles.switchLink, { color: t.ochre }]}>Sign up</Text>
            </Pressable>
          </View>

          {/* Auth is additive, never a gate (brief Section 0/1). */}
          <Pressable onPress={onDismiss} style={styles.laterRow}>
            <Text style={[styles.laterText, { color: t.inkDim }]}>Not now</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    padding: SPACING.m,
    paddingBottom: SPACING.xl * 2,
  },
  header: {
    alignItems: "center",
    marginTop: SPACING.xl,
    marginBottom: SPACING.l,
    gap: SPACING.s,
  },
  title: {
    fontSize: TYPE.title,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: TYPE.body,
  },
  errorBanner: {
    borderRadius: RADII.card,
    borderWidth: 1.5,
    padding: SPACING.m,
    marginBottom: SPACING.l,
    gap: SPACING.s,
  },
  errorText: {
    fontSize: TYPE.small,
    lineHeight: 18,
    fontWeight: "500",
  },
  errorLink: {
    fontSize: TYPE.small,
    fontWeight: "700",
    marginTop: 4,
  },
  field: {
    marginBottom: SPACING.m,
  },
  label: {
    fontSize: TYPE.tiny,
    fontWeight: "700",
    letterSpacing: TRACKING.wide,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: RADII.card,
    borderWidth: 1,
    paddingHorizontal: SPACING.s,
    paddingVertical: 12,
    fontSize: TYPE.body,
    lineHeight: 20,
  },
  passwordWrap: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 60,
  },
  showToggle: {
    position: "absolute",
    right: SPACING.s,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  showToggleText: {
    fontSize: TYPE.small,
    fontWeight: "700",
  },
  fieldError: {
    fontSize: TYPE.small,
    marginTop: 4,
  },
  submitButton: {
    borderRadius: RADII.button,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.l,
    marginBottom: SPACING.m,
    minHeight: 48,
  },
  submitText: {
    fontSize: TYPE.body,
    fontWeight: "800",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SPACING.m,
  },
  switchText: {
    fontSize: TYPE.body,
  },
  switchLink: {
    fontSize: TYPE.body,
    fontWeight: "700",
  },
  laterRow: {
    alignItems: "center",
    marginTop: SPACING.l,
    minHeight: 32,
    justifyContent: "center",
  },
  laterText: {
    fontSize: TYPE.small,
    fontWeight: "600",
  },
});
