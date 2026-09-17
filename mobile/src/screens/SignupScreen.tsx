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
import { CountryPicker, findCountry, type Country } from "../components/CountryPicker";
import { GoogleButton } from "../components/GoogleButton";
import { useAuth, type AuthError } from "../store/auth";
import type { SignupParams } from "../api/auth";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface FieldErrors {
  fullName?: string;
  phone?: string;
  email?: string;
  country?: string;
  password?: string;
}

function validateField(
  name: keyof FieldErrors,
  value: string,
  country: Country | null,
): string | undefined {
  switch (name) {
    case "fullName":
      if (!value.trim()) return "Name is required.";
      if (value.trim().length < 2) return "Name must be at least 2 characters.";
      return undefined;
    case "phone":
      if (!value.trim()) return "Phone number is required.";
      // Basic digit check — Supabase validates the E.164 format server-side.
      const digits = value.replace(/[^\d]/g, "");
      if (digits.length < 7) return "Phone number is too short.";
      if (digits.length > 15) return "Phone number is too long.";
      return undefined;
    case "email":
      if (!value.trim()) return "Email address is required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Enter a valid email address.";
      return undefined;
    case "country":
      if (!country) return "Please select your country.";
      return undefined;
    case "password":
      if (!value) return "Password is required.";
      if (value.length < 8) return "Password must be at least 8 characters.";
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

interface SignupScreenProps {
  onSwitchToLogin: () => void;
}

export function SignupScreen({ onSwitchToLogin }: SignupScreenProps) {
  const { tokens: t } = useTheme();
  const { signup, loading, error, clearError } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
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
      const value = name === "country" ? "" : name === "password" ? password : name === "fullName" ? fullName : name === "phone" ? phone : email;
      const err = validateField(name, value, country);
      setErrors((prev) => ({ ...prev, [name]: err }));
    },
    [fullName, phone, email, country, password],
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: FieldErrors = {
      fullName: validateField("fullName", fullName, country),
      phone: validateField("phone", phone, country),
      email: validateField("email", email, country),
      country: validateField("country", "", country),
      password: validateField("password", password, country),
    };
    setErrors(newErrors);
    setTouched({ fullName: true, phone: true, email: true, country: true, password: true });
    const hasError = Object.values(newErrors).some(Boolean);
    if (hasError) triggerShake();
    return !hasError;
  }, [fullName, phone, email, country, password, triggerShake]);

  const handleSignup = useCallback(async () => {
    clearError();
    if (!validateAll()) return;

    const dialCode = country?.dialCode ?? "";
    const fullPhone = phone.startsWith("+") ? phone : `${dialCode}${phone}`;

    await signup({
      fullName: fullName.trim(),
      phone: fullPhone,
      email: email.trim().toLowerCase(),
      country: country?.code ?? "",
      password,
    });
  }, [fullName, phone, email, country, password, signup, clearError, validateAll]);

  const handleGooglePress = useCallback(() => {
    // Placeholder — Google OAuth not yet wired.
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]} edges={["bottom"]}>
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
            <Text style={[styles.title, { color: t.ink }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: t.inkDim }]}>
              Start translating Kinyarwanda ↔ Mandarin
            </Text>
          </View>

          {/* Error banner */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: t.rustSoft, borderColor: t.rust }]}>
              <Text style={[styles.errorText, { color: t.rust }]}>{error.message}</Text>
              {error.kind === "EMAIL_EXISTS" && (
                <Pressable onPress={onSwitchToLogin}>
                  <Text style={[styles.errorLink, { color: t.ochre }]}>Log in instead</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Form */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: t.inkDim }]}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                onBlur={() => handleBlur("fullName")}
                placeholder="Full name"
                placeholderTextColor={t.inkDim}
                autoCapitalize="words"
                autoCorrect={false}
                style={[
                  styles.input,
                  {
                    backgroundColor: t.surface3,
                    borderColor: touched.fullName && errors.fullName ? t.rust : t.line,
                    color: t.ink,
                  },
                ]}
              />
              {touched.fullName && errors.fullName && (
                <Text style={[styles.fieldError, { color: t.rust }]}>{errors.fullName}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: t.inkDim }]}>Phone number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.dialCodeWrap}>
                  <Text style={[styles.dialCodeText, { color: t.ink }]}>
                    {country ? `${country.flag} ${country.dialCode}` : "+250"}
                  </Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  onBlur={() => handleBlur("phone")}
                  placeholder="Phone number"
                  placeholderTextColor={t.inkDim}
                  keyboardType="phone-pad"
                  style={[
                    styles.input,
                    styles.phoneInput,
                    {
                      backgroundColor: t.surface3,
                      borderColor: touched.phone && errors.phone ? t.rust : t.line,
                      color: t.ink,
                    },
                  ]}
                />
              </View>
              {touched.phone && errors.phone && (
                <Text style={[styles.fieldError, { color: t.rust }]}>{errors.phone}</Text>
              )}
            </View>

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
              <Text style={[styles.label, { color: t.inkDim }]}>Country</Text>
              <CountryPicker
                value={country}
                onSelect={setCountry}
                placeholder="Country"
              />
              {touched.country && errors.country && (
                <Text style={[styles.fieldError, { color: t.rust }]}>{errors.country}</Text>
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
            onPress={handleSignup}
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
              <Text style={[styles.submitText, { color: t.surface }]}>Sign up</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: t.line }]} />
            <Text style={[styles.dividerText, { color: t.inkDim }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: t.line }]} />
          </View>

          {/* Google placeholder */}
          <GoogleButton onPress={handleGooglePress} />

          {/* Switch to login */}
          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: t.inkDim }]}>Already have an account? </Text>
            <Pressable onPress={onSwitchToLogin}>
              <Text style={[styles.switchLink, { color: t.ochre }]}>Log in</Text>
            </Pressable>
          </View>
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
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.s,
    marginBottom: SPACING.m,
  },
  errorText: {
    fontSize: TYPE.small,
    lineHeight: 18,
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
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.s,
    paddingVertical: 12,
    fontSize: TYPE.body,
  },
  phoneRow: {
    flexDirection: "row",
    gap: SPACING.s,
  },
  dialCodeWrap: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    borderRadius: RADII.card,
    paddingHorizontal: SPACING.s,
    justifyContent: "center",
  },
  dialCodeText: {
    fontSize: TYPE.body,
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
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
    marginTop: SPACING.s,
    minHeight: 48,
  },
  submitText: {
    fontSize: TYPE.body,
    fontWeight: "800",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.l,
    gap: SPACING.s,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: TYPE.small,
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
});
