export interface GenerateProjectResponse {
    url?: string;
    projectId?: string;
    }

// Dev: через Vite proxy → /xtiles/..., Prod: напряму (можеш підставити stage теж)
const XTILES_ENDPOINT =
  (import.meta as any).env?.DEV
    ? '/xtiles/api/ai/gpt/generate-from-md'
    : '/api/xtiles/generate';

    export async function sendMarkdownToXtiles(md: string, projectId?: string): Promise<GenerateProjectResponse> {
        const payload = {
          content: md,
          email: "",
          emailsData: "",
          source: "EMAIL_BOT",
          metaInfo: { processId: "c00fb76cb8ee407f896876be" },
         ...(projectId ? { projectId } : {}), // <-- додаємо коли є
        };
     
        const res = await fetch(XTILES_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
     
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`xTiles API error ${res.status}: ${errText}`);
        }
     
        const data = await res.json();
        return {
            url: data?.url ?? data?.data?.url,
            projectId: data?.projectId ?? data?.data?.projectId,
            };
}
