import { streamText } from "ai";
import { localOllama, OLLAMA_MODEL } from "@/lib/localOllama";

export async function GET() {
  try {
    const result = streamText({
      model: localOllama(OLLAMA_MODEL),
      messages: [
        {
          role: "system",
          content: "You are a helpful flight search assistant.",
        },
        {
          role: "user",
          content:
            "Say hello and confirm you are operational. Keep it brief (2-3 sentences).",
        },
      ],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to connect to Ollama",
      },
      { status: 500 }
    );
  }
}
