import { supabase } from "@/integrations/supabase/client";

type InvokeEdgeFunctionOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

const parseResponse = async (response: Response) => {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const invokeViaFetch = async (
  functionName: string,
  { body = {}, headers = {} }: InvokeEdgeFunctionOptions = {}
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await parseResponse(response);

  if (!response.ok) {
    const errorMessage =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return data;
};

export const invokeEdgeFunction = async (
  functionName: string,
  options: InvokeEdgeFunctionOptions = {}
) => {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options.body ?? {},
      headers: options.headers,
    });

    if (error) throw error;

    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("Failed to send a request to the Edge Function")) {
      throw error;
    }

    return invokeViaFetch(functionName, options);
  }
};