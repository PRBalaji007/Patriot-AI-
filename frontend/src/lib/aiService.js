import { supabase } from "./supabaseClient";

const AI_API_URL =
  import.meta.env.VITE_AI_API_URL || "http://127.0.0.1:8000";

/**
 * Sends an image to the PATRIOT AI backend.
 *
 * model:
 * - both
 * - civic_issues
 * - disasters_accidents
 */
export async function classifyImage(file, model = "both") {
  if (!(file instanceof File)) {
    throw new Error("Please select a valid image file.");
  }

  if (
    !["both", "civic_issues", "disasters_accidents"].includes(model)
  ) {
    throw new Error("Invalid AI classification model.");
  }

  const formData = new FormData();
  formData.append("file", file);

  let response;

  try {
    response = await fetch(
      `${AI_API_URL}/api/predict?model=${encodeURIComponent(model)}`,
      {
        method: "POST",
        body: formData,
      }
    );
  } catch {
    throw new Error(
      "Unable to connect to PATRIOT AI. Check whether the backend is running."
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The AI backend returned an invalid response.");
  }

  if (!response.ok) {
    const message =
      typeof result.detail === "string"
        ? result.detail
        : "AI classification failed.";

    throw new Error(message);
  }

  if (!result.success || !result.predictions) {
    throw new Error(
      "The AI backend returned an incomplete prediction."
    );
  }

  return result;
}

/**
 * Checks whether the PATRIOT AI backend is reachable.
 */
export async function checkAIBackend() {
  try {
    const response = await fetch(`${AI_API_URL}/api/health`);

    if (!response.ok) {
      return false;
    }

    const result = await response.json();

    return result.success === true;
  } catch {
    return false;
  }
}

/**
 * Submit citizen report.
 *
 * IMPORTANT:
 * The Supabase session is obtained directly here.
 * We do NOT depend on CitizenReport.jsx passing an access token.
 */
export async function submitCitizenReport({
  description,
  priority,
  address,
  latitude,
  longitude,
  image,
}) {
  // Get the current authenticated Supabase session.
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      `Unable to read your login session: ${sessionError.message}`
    );
  }

  if (!session?.access_token) {
    throw new Error(
      "Your login session is not available. Please sign in again."
    );
  }

  const formData = new FormData();

  formData.append("description", description);
  formData.append("priority", priority);

  if (address) {
    formData.append("address", address);
  }

  if (
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined
  ) {
    formData.append("latitude", String(latitude));
    formData.append("longitude", String(longitude));
  }

  if (image instanceof File) {
    formData.append("file", image);
  }

  let response;

  try {
    console.log("PATRIOT: submitting citizen report...");

    response = await fetch(`${AI_API_URL}/api/submit`, {
      method: "POST",

      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },

      body: formData,
    });
  } catch (error) {
    console.error("PATRIOT submit connection error:", error);

    throw new Error(
      "Cannot connect to PATRIOT backend. Make sure the backend is running."
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The PATRIOT backend returned an invalid response."
    );
  }

  console.log(
    "PATRIOT report submission response:",
    response.status,
    result
  );

  if (!response.ok) {
    const detail = result.detail;

    const message = Array.isArray(detail)
      ? detail.map(item => item.msg).join(", ")
      : typeof detail === "string"
        ? detail
        : "Report submission failed.";

    throw new Error(message);
  }

  if (!result.success || !result.report) {
    throw new Error(
      "The report was not confirmed as saved."
    );
  }

  return result;
}