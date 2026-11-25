import { supabase } from "./supabaseClient";

const AI_API_URL =
  import.meta.env.VITE_AI_API_URL || "http://127.0.0.1:8000";

async function getAccessToken() {
  const {
    data,
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const token = data?.session?.access_token;

  if (!token) {
    throw new Error(
      "Your administrator session has expired. Please sign in again."
    );
  }

  return token;
}

export async function fetchAdminReports() {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${AI_API_URL}/api/admin/reports`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The PATRIOT backend returned an invalid response."
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Unable to load administrator reports."
    );
  }

  return result;
}

export async function fetchAdminReportImageUrl(reportId) {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${AI_API_URL}/api/admin/reports/${encodeURIComponent(
      reportId
    )}/image-url`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The PATRIOT backend returned an invalid image response."
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Unable to load the report image."
    );
  }

  return result.url || null;
}