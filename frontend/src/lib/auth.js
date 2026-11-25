import { supabase } from "./supabaseClient";

const normalizedEmail = (email) => {
  if (!email || typeof email !== "string") {
    throw new Error("Please enter a valid email address.");
  }

  return email.trim().toLowerCase();
};

/**
 * Citizen registration
 */
export async function signUpCitizen({
  displayName,
  email,
  phone,
  password,
}) {
  const cleanEmail = normalizedEmail(email);

  if (!displayName?.trim()) {
    throw new Error("Please enter your name.");
  }

  if (!password || password.length < 6) {
    throw new Error("Password must contain at least 6 characters.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        display_name: displayName.trim(),
        phone: phone?.trim() || "",
        account_intent: "citizen",
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Department first-time registration + access request
 */
export async function signUpDepartmentRequest({
  contactName,
  officialEmail,
  phone,
  password,
  departmentId,
  notes,
}) {
  const email = normalizedEmail(officialEmail);

  if (!contactName?.trim()) {
    throw new Error("Please enter the contact name.");
  }

  if (!departmentId) {
    throw new Error("Please select a department.");
  }

  if (!password || password.length < 6) {
    throw new Error("Password must contain at least 6 characters.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        display_name: contactName.trim(),
        phone: phone?.trim() || "",
        account_intent: "department",
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    const { error: appError } = await supabase
      .from("department_applications")
      .insert({
        applicant_id: data.user.id,
        department_id: departmentId,
        official_email: email,
        contact_name: contactName.trim(),
        notes: notes?.trim() || null,
        status: "pending",
      });

    // Ignore duplicate application
    if (appError && appError.code !== "23505") {
      throw appError;
    }
  }

  return data;
}

/**
 * Resend email confirmation
 */
export async function resendRegistrationEmail(email) {
  const cleanEmail = normalizedEmail(email);

  const { data, error } = await supabase.auth.resend({
    type: "signup",
    email: cleanEmail,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign in and determine portal access.
 */
export async function signInWithRoleCheck(
  email,
  password,
  expectedPortal = "citizen"
) {
  const cleanEmail = normalizedEmail(email);

  if (!password) {
    throw new Error("Please enter your password.");
  }

  /*
   * Step 1:
   * Authenticate directly with Supabase.
   */
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.user) {
    throw new Error("Supabase did not return a user after sign-in.");
  }

  /*
   * Step 2:
   * Make sure we actually have a session.
   */
  let session = data.session;

  if (!session) {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(
        `Unable to retrieve your Supabase session: ${sessionError.message}`
      );
    }

    session = sessionData?.session;
  }

  if (!session?.access_token) {
    throw new Error(
      "Login succeeded, but Supabase did not create a valid session."
    );
  }

  /*
   * Step 3:
   * Verify email confirmation.
   */
  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut();

    throw new Error(
      "Please confirm your email via the verification link before signing in."
    );
  }

  /*
   * Step 4:
   * Load the PATRIOT profile.
   *
   * We use maybeSingle() instead of single() so a missing
   * profile does not produce an uncontrolled Supabase error.
   */
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, role, department_id, display_name")
    .eq("id", data.user.id)
    .maybeSingle();

  /*
   * A real database/RLS error is different from a missing profile.
   */
  if (profileError) {
    console.error("PATRIOT profile lookup failed:", profileError);

    throw new Error(
      `Login succeeded, but PATRIOT could not load your profile. ${profileError.message}`
    );
  }

  /*
   * If the Auth user exists but the profile row does not,
   * don't pretend the user has a valid PATRIOT role.
   */
  if (!profile) {
    throw new Error(
      "Your Supabase account exists, but your PATRIOT profile was not found. Please contact the administrator or complete registration again."
    );
  }

  /*
   * Normalize role.
   */
  const role = String(profile.role || "").toLowerCase();

  /*
   * Admin can enter from any portal.
   */
  if (role === "admin") {
    return {
      ...data,
      session,
      profile,
      accessState: "approved",
    };
  }

  /*
   * Department portal.
   */
  if (
    expectedPortal === "department" ||
    role === "department"
  ) {
    if (role === "department" && profile.department_id) {
      return {
        ...data,
        session,
        profile,
        accessState: "approved",
      };
    }

    const {
      data: application,
      error: applicationError,
    } = await supabase
      .from("department_applications")
      .select(
        "id, status, notes, created_at, departments(name)"
      )
      .eq("applicant_id", data.user.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (applicationError) {
      console.error(
        "Department application lookup failed:",
        applicationError
      );

      throw new Error(
        `Unable to check department application status. ${applicationError.message}`
      );
    }

    if (application?.status === "pending") {
      return {
        ...data,
        session,
        profile,
        application,
        accessState: "pending_approval",
      };
    }

    if (application?.status === "rejected") {
      return {
        ...data,
        session,
        profile,
        application,
        accessState: "rejected",
      };
    }

    return {
      ...data,
      session,
      profile,
      accessState: "needs_application",
    };
  }

  /*
   * Citizen portal.
   */
  if (expectedPortal === "citizen") {
    if (role !== "citizen") {
      await supabase.auth.signOut();

      throw new Error(
        `This account is not registered as a citizen account. Current role: ${role || "unknown"}`
      );
    }

    return {
      ...data,
      session,
      profile,
      accessState: "approved",
    };
  }

  /*
   * Generic fallback.
   */
  return {
    ...data,
    session,
    profile,
    accessState: "approved",
  };
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}