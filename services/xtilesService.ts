// services/xtilesService.ts

export interface GenerateProjectResponse {
  url?: string;
  projectId?: string;
}

/**
 * Ендпоінт:
 * - Якщо задано VITE_XTILES_API_BASE / REACT_APP_XTILES_API_BASE — беремо його.
 * - Інакше у DEV: /xtiles/... (через Vite proxy → stage).
 * - У PROD: напряму на stage.
 */
const ENV = (import.meta as any)?.env ?? {};
const IS_DEV = !!ENV?.DEV;

const EXPLICIT_BASE =
  ENV?.VITE_XTILES_API_BASE ||
  ENV?.REACT_APP_XTILES_API_BASE ||
  (typeof process !== 'undefined' ? (process as any)?.env?.XTILES_API_BASE : undefined);

const XTILES_ENDPOINT = EXPLICIT_BASE
  ? EXPLICIT_BASE
  : IS_DEV
  ? '/xtiles/api/ai/gpt/generate-from-md'
  : 'https://stage.xtiles.app/api/ai/gpt/generate-from-md';

const XTILES_API_KEY =
  ENV?.VITE_XTILES_API_KEY ||
  ENV?.REACT_APP_XTILES_API_KEY ||
  (typeof process !== 'undefined' ? (process as any)?.env?.XTILES_API_KEY : undefined);

/**
 * Надсилає Markdown до xTiles.
 * Новий stage-пейлоад: { markdown, projectId? }
 */
export async function sendMarkdownToXtiles(
  md: string,
  projectId?: string
): Promise<GenerateProjectResponse> {
  const body: Record<string, any> = {
    markdown: md,
    ...(projectId ? { projectId } : {}),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (XTILES_API_KEY) {
    headers['Authorization'] = `Bearer ${XTILES_API_KEY}`;
  }

  // Debug-лог
  console.groupCollapsed('%c[POST → xTiles] request', 'color:#f59e0b');
  console.log('endpoint:', XTILES_ENDPOINT);
  console.log('projectId:', projectId ?? null);
  console.log('markdown.length:', md?.length ?? 0);
  console.groupEnd();

  const res = await fetch(XTILES_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await safeText(res);
    console.error('[xTiles] publish failed:', res.status, res.statusText, errText);
    throw new Error(`xTiles API error ${res.status}: ${errText || res.statusText}`);
  }

  const data = await safeJson(res);
  const result: GenerateProjectResponse = {
    url: data?.url ?? data?.data?.url,
    projectId: data?.projectId ?? data?.data?.projectId,
  };

  console.groupCollapsed('%c[POST → xTiles] response', 'color:#84cc16');
  console.log('status:', res.status);
  console.log('projectId:', result.projectId);
  console.log('url:', result.url);
  console.groupEnd();

  return result;
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
