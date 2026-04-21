import "./env";
import { request } from "node:https";

type OpenAIInputMessage = {
  role: "user" | "assistant" | "system" | "developer";
  content: string;
};

type OpenAIResponseContent = {
  type?: string;
  text?: string;
};

type OpenAIResponseOutput = {
  type?: string;
  content?: OpenAIResponseContent[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIResponseOutput[];
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY must be set.");
}

export async function generateText({
  instructions,
  input,
  maxOutputTokens = 1024,
}: {
  instructions: string;
  input: OpenAIInputMessage[];
  maxOutputTokens?: number;
}) {
  const resolvedApiKey = apiKey;
  if (!resolvedApiKey) {
    throw new Error("OPENAI_API_KEY must be set.");
  }
  const body = await postJson<OpenAIResponse>(
    OPENAI_RESPONSES_URL,
    {
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
    },
    resolvedApiKey,
  );

  return extractText(body);
}

function extractText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text)
    .join("");

  return text || "";
}

function postJson<T>(url: string, payload: unknown, apiKey: string) {
  const requestUrl = new URL(url);
  const requestBody = JSON.stringify(payload);

  return new Promise<T>((resolve, reject) => {
    const req = request(
      {
        hostname: requestUrl.hostname,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
      },
      (res) => {
        let responseBody = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          const parsedBody = parseJson(responseBody);
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            const message =
              typeof parsedBody?.error?.message === "string"
                ? parsedBody.error.message
                : `OpenAI request failed with status ${res.statusCode ?? "unknown"}`;
            reject(new Error(message));
            return;
          }

          resolve(parsedBody as T);
        });
      },
    );

    req.on("error", reject);
    req.write(requestBody);
    req.end();
  });
}

function parseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
