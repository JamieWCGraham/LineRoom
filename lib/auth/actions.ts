"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";
import { getAuthUser } from "@/lib/auth/guards";
import { getSiteUrl } from "@/lib/auth/oauth";

export type AuthFormState = {
  fieldErrors?: { email?: string; password?: string };
  message?: string;
};

function validateEmail(email: string): string | undefined {
  if (!email) return "Required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return "Required";
  if (password.length < 6) return "At least 6 characters";
  return undefined;
}

export async function login(
  _prev: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  const eErr = validateEmail(email);
  const pErr = validatePassword(password);
  if (eErr) fieldErrors.email = eErr;
  if (pErr) fieldErrors.password = pErr;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { message: error.message };

  const user = await getAuthUser(supabase);
  if (user) await ensureProfile(supabase, user);
  redirect("/dashboard");
}

export async function signup(
  _prev: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  const eErr = validateEmail(email);
  const pErr = validatePassword(password);
  if (eErr) fieldErrors.email = eErr;
  if (pErr) fieldErrors.password = pErr;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const confirmUrl = `${getSiteUrl()}/auth/confirm`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: confirmUrl },
  });
  if (error) return { message: error.message };

  if (data.user && data.session) {
    await ensureProfile(supabase, data.user);
    redirect("/dashboard");
  }

  return {
    message:
      "Check your email to confirm your account, then sign in.",
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type ProfileFormState = { message?: string; fieldErrors?: { username?: string } };

export async function updateProfile(
  _prev: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");

  const display_name = String(formData.get("display_name") ?? "").trim() || null;
  const usernameRaw = String(formData.get("username") ?? "").trim();
  const username = usernameRaw.length ? usernameRaw : null;
  const avatar_url = String(formData.get("avatar_url") ?? "").trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name,
      username,
      avatar_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { username: "That username is taken." } };
    }
    return { message: error.message };
  }

  redirect("/account?saved=1");
}
