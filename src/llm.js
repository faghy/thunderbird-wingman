// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

import Anthropic from "@anthropic-ai/sdk";

// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

function client(apiKey) {
  // The key lives in the extension's own storage and requests go straight to the API.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export async function checkApiKey(apiKey, model) {
  await client(apiKey).models.retrieve(model);
}

// One request whose answer is constrained to `schema`; returns the parsed JSON.
export async function structuredCall({ apiKey, model, system, user, schema, effort, maxTokens }) {
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort, format: { type: "json_schema", schema } },
  };
  const api = client(apiKey);
  let response;
  try {
    response = FALLBACK_MODELS.has(model)
      ? await api.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await api.messages.create(params);
  } catch (error) {
    throw new Error(describeApiError(error));
  }
  if (response.stop_reason === "refusal") {
    throw new Error(`Il modello ha rifiutato la richiesta (${response.stop_details?.category ?? "motivo non indicato"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Risposta troncata: limite di token raggiunto");
  }
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

export function describeApiError(error) {
  if (error instanceof Anthropic.AuthenticationError) return "Chiave API non valida";
  if (error instanceof Anthropic.PermissionDeniedError) return "La chiave API non ha accesso a questo modello";
  if (error instanceof Anthropic.NotFoundError) return "Modello non trovato";
  if (error instanceof Anthropic.RateLimitError) return "Limite di richieste raggiunto, riprovo più tardi";
  if (error instanceof Anthropic.BadRequestError) return `Richiesta non valida: ${error.message}`;
  if (error instanceof Anthropic.APIError) return `Errore API ${error.status ?? ""}: ${error.message}`;
  return String(error?.message || error);
}
