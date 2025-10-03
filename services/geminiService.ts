// services/geminiService.ts
import {
  GoogleGenAI,
  Chat,
  GenerateContentResponse,
} from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../constants';
import { sendMarkdownToXtiles } from './xtilesService';

// Якщо у вас є тип GroundingSource — залиште, інакше замініть на any[]
export type GroundingSource = { uri: string; title?: string } | any;

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('API_KEY environment variable not set');

const ai = new GoogleGenAI({ apiKey: API_KEY });

/** -------------------------------
 *  Режими генерації
 *  ------------------------------- */
export enum GenerationMode {
  STATEFUL = 'STATEFUL',
  FULL_HISTORY = 'FULL_HISTORY',
}

let currentMode: GenerationMode = GenerationMode.STATEFUL;
export function setGenerationMode(mode: GenerationMode) {
  currentMode = mode;
  console.info('[AI MODE] setGenerationMode =', currentMode);
  // При зміні режиму — чистимо сесію й акумулятори
  resetSession();
}
export function getGenerationMode() {
  return currentMode;
}

/** -------------------------------
 *  Публічний тип відповіді
 *  ------------------------------- */
export interface GeminiResponse {
  text: string;
  sources: GroundingSource[];
  /** КУМУЛЯТИВНІ токени з початку діалогу (по сесії) */
  inputTokens: number;
  outputTokens: number;
  /** КУМУЛЯТИВНІ кешовані токени (реальні з usageMetadata.cachedContentTokenCount) */
  cachedTokens: number;
  projectUrl?: string;
  projectId?: string;
  mode: GenerationMode;
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

/** -------------------------------
 *  Глобальні акумулятори токенів (сесія)
 *  ------------------------------- */
let ACC_INPUT = 0;
let ACC_OUTPUT = 0;
let ACC_CACHED = 0;

function resetTokenAccumulators() {
  ACC_INPUT = 0;
  ACC_OUTPUT = 0;
  ACC_CACHED = 0;
  console.info('[TOKENS] accumulators reset');
}

/** -------------------------------
 *  Stateful Chat для STATEFUL-режиму
 *  ------------------------------- */
let statefulChat: Chat | undefined;

export function resetChat() {
  statefulChat = undefined;
  console.info('[AI MODE] stateful Chat reset');
}

/** Повний скидання сесії */
export function resetSession() {
  resetChat();
  resetTokenAccumulators();
}

/** -------------------------------
 *  Допоміжні утиліти
 *  ------------------------------- */
function buildUserPrompt(userText: string): string {
  // !!! Це саме user message, НЕ частина системної інструкції
  return `Now, based on all the rules above,  generate a project plan for the following user request:
" ${userText} "`;
}

function serializeHistoryStructured(allMessages: ChatTurn[]): { role: 'user' | 'assistant'; text: string }[] {
  return (allMessages ?? []).map(m => ({ role: m.role, text: m.content }));
}

function pickSources(resp: GenerateContentResponse): GroundingSource[] {
  const gm = (resp as any)?.candidates?.[0]?.groundingMetadata;
  return gm?.groundingChunks
    ? gm.groundingChunks.map((c: any) => c.web).filter((w: any) => !!w && !!w.uri)
    : [];
}

function readUsage(resp: GenerateContentResponse) {
  const um = resp?.usageMetadata ?? ({} as any);
  const prompt = um.promptTokenCount ?? 0;
  const output = um.candidatesTokenCount ?? 0;
  const cached = um.cachedContentTokenCount ?? 0; // <-- реальні кешовані токени
  return { prompt, output, cached };
}

/** ==========================================================
 *  STRATEGY 1: STATEFUL — 1 Chat на сесію, історію не шлемо
 *  ========================================================== */
function getOrCreateStatefulChat() {
  if (!statefulChat) {
    statefulChat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 1.45 },
    });
    console.info('[AI MODE] STATEFUL Chat created');
  }
  return statefulChat;
}

async function sendStateful(
  userText: string,
  currentProjectId?: string,
  _allMessages?: ChatTurn[] // НЕ передаємо в модель; тут не потрібен
): Promise<GeminiResponse> {
  console.info('[AI MODE] STATEFUL (ai.chats.create)');

  const chat = getOrCreateStatefulChat();
  // Перший (і кожний) реальний user-запит: "Now, based on all the rules above, ..."
  const composedUser = buildUserPrompt(userText);
  const resp = await chat.sendMessage({ message: composedUser });

  console.groupCollapsed('%c[AI RAW][STATEFUL] model output', 'color:#4ade80');
  console.log('text (MD):\n', (resp.text ?? '').trim());
  console.log('usage:', resp.usageMetadata);
  console.groupEnd();

  const u = readUsage(resp);
  ACC_INPUT += u.prompt;
  ACC_OUTPUT += u.output;
  ACC_CACHED += u.cached;

  const md = (resp.text ?? '').trim();

  const final: GeminiResponse = {
    text: md ? '' : 'Порожня відповідь моделі (STATEFUL).',
    sources: pickSources(resp),
    inputTokens: ACC_INPUT,
    outputTokens: ACC_OUTPUT,
    cachedTokens: ACC_CACHED,
    projectUrl: undefined,
    projectId: currentProjectId,
    mode: GenerationMode.STATEFUL,
  };

  if (md) {
    const sent = await sendMarkdownToXtiles(md, currentProjectId);
    console.groupCollapsed('%c[POST → xTiles][STATEFUL]', 'color:#f59e0b');
    console.log('projectId:', sent.projectId, 'url:', sent.url);
    console.groupEnd();

    final.projectId = sent.projectId ?? currentProjectId;
    final.projectUrl = sent.url ?? final.projectUrl;
  }

  console.log('[TOKENS][STATEFUL] add:', u, 'totals:', {
    input: ACC_INPUT,
    output: ACC_OUTPUT,
    cached: ACC_CACHED,
  });

  return final;
}

/** ==========================================================
 *  STRATEGY 2: FULL_HISTORY — без state, вся історія в запиті
 *  ========================================================== */
async function sendFullHistory(
  userText: string,
  currentProjectId: string | undefined,
  allMessages: ChatTurn[]
): Promise<GeminiResponse> {
  console.info('[AI MODE] FULL_HISTORY (stateless input with full transcript)');

  const structured = serializeHistoryStructured(allMessages);
  const composedUser = buildUserPrompt(userText);

  let resp: GenerateContentResponse;

  const hasResponsesApi =
    (ai as any).responses && typeof (ai as any).responses.generate === 'function';

  if (hasResponsesApi) {
    // Responses API: усі попередні ходи як окремі parts + фінальний user-ранд
    const inputTurns = [
      ...structured.map(t => ({
        role: t.role,
        parts: [{ text: t.text }],
      })),
      { role: 'user', parts: [{ text: composedUser }] },
    ];

    resp = await (ai as any).responses.generate({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      input: inputTurns,
      config: {
        temperature: 1.45,
      },
    });
    console.groupCollapsed('%c[AI RAW][FULL_HISTORY] model output', 'color:#60a5fa');
  console.log('text (MD):\n', (resp.text ?? '').trim());
  console.log('usage:', resp.usageMetadata);
  console.groupEnd();
  } else {
    // Fallback: одноразовий Chat, але всю історію явно додаємо контентом
    const oneOff = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    const historyBlob = JSON.stringify(structured, null, 2);
    resp = await oneOff.sendMessage({
      message: [
        { text: `HISTORY (full transcript as JSON with roles):\n${historyBlob}` },
        { text: composedUser },
      ] as any,
    });
  }

  const u = readUsage(resp);
  ACC_INPUT += u.prompt;
  ACC_OUTPUT += u.output;
  ACC_CACHED += u.cached; // implicit cache може спрацювати і тут

  const md = (resp.text ?? '').trim();

  const final: GeminiResponse = {
    text: md ? '' : 'Порожня відповідь моделі (FULL_HISTORY).',
    sources: pickSources(resp),
    inputTokens: ACC_INPUT,
    outputTokens: ACC_OUTPUT,
    cachedTokens: ACC_CACHED,
    projectUrl: undefined,
    projectId: currentProjectId,
    mode: GenerationMode.FULL_HISTORY,
  };

  if (md) {
    const sent = await sendMarkdownToXtiles(md, currentProjectId);
    console.groupCollapsed('%c[POST → xTiles][FULL_HISTORY]', 'color:#f59e0b');
    console.log('projectId:', sent.projectId, 'url:', sent.url);
    console.groupEnd();

    final.projectId = sent.projectId ?? currentProjectId;
    final.projectUrl = sent.url ?? final.projectUrl;
  }

  console.log('[TOKENS][FULL_HISTORY] add:', u, 'totals:', {
    input: ACC_INPUT,
    output: ACC_OUTPUT,
    cached: ACC_CACHED,
  });

  return final;
}

/** -------------------------------
 *  Публічний фасад — перемикає стратегії
 *  ------------------------------- */
export async function sendMessageToGemini(
  userText: string,
  _useContextTool: boolean,     // для сумісності з існуючим інтерфейсом
  _includeHistory: boolean,     // ігноруємо; керуємося mode
  currentProjectId?: string,
  options?: {
    allMessages?: ChatTurn[];
  }
) {
  if (currentMode === GenerationMode.STATEFUL) {
    return sendStateful(userText, currentProjectId, options?.allMessages);
  }
  // FULL_HISTORY
  const history = options?.allMessages ?? [];
  return sendFullHistory(userText, currentProjectId, history);
}
