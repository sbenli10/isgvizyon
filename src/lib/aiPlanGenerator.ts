import { invokeEdgeFunction } from "@/lib/ai/invokeEdgeFunction";

export interface AIPlanRoom {
  id?: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AIPlanPointItem {
  id?: string;
  name?: string;
  x: number;
  y: number;
}

export interface AIPlanRoute {
  id?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AIEvacuationPlan {
  rooms: AIPlanRoom[];
  exits: AIPlanPointItem[];
  extinguishers: AIPlanPointItem[];
  routes: AIPlanRoute[];
}

interface EvacuationPlanResponse {
  success: true;
  plan: AIEvacuationPlan;
}

function mapEvacuationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("invalid_payload")) {
    return "Tahliye plani icin gonderilen icerik gecersiz.";
  }
  if (message.includes("bos yanit") || message.includes("empty")) {
    return "Yapay zeka gecerli bir tahliye plani donmedi.";
  }
  if (message.includes("yogun") || message.includes("rate")) {
    return "Yapay zeka servisi su anda yogun. Biraz sonra tekrar deneyin.";
  }

  return error instanceof Error ? error.message : "Tahliye plani olusturulamadi.";
}

export async function generateEvacuationPlan(prompt: string): Promise<AIEvacuationPlan> {
  const userPrompt = prompt.trim();
  if (!userPrompt) {
    throw new Error("Bina aciklamasi bos olamaz.");
  }

  try {
    const response = await invokeEdgeFunction<EvacuationPlanResponse>("evacuation-ai", {
      action: "plan",
      prompt: userPrompt,
    });
    return response.plan;
  } catch (error) {
    throw new Error(mapEvacuationError(error));
  }
}

export async function improveEvacuationPlan(
  currentPlan: AIEvacuationPlan,
  instruction: string,
): Promise<AIEvacuationPlan> {
  const trimmedInstruction = instruction.trim();
  if (!trimmedInstruction) {
    throw new Error("Iyilestirme aciklamasi bos olamaz.");
  }

  try {
    const response = await invokeEdgeFunction<EvacuationPlanResponse>("evacuation-ai", {
      action: "improve",
      prompt: trimmedInstruction,
      currentPlan,
    });
    return response.plan;
  } catch (error) {
    throw new Error(mapEvacuationError(error));
  }
}
