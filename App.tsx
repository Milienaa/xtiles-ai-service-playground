// App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Message, MessageRole } from './types';
import {
  sendMessageToGemini,
  resetSession,
  setGenerationMode,
  GenerationMode,
} from './services/geminiService';
import Header from './components/Header';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import { AssistantIcon } from './components/Icons';

const initialMessage: Message = {
  id: 'initial-message',
  role: MessageRole.MODEL,
  content:
    'Привіт! Я ваш асистент. Що б ви хотіли створити, спланувати або організувати сьогодні?',
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenCount, setTokenCount] =
    useState<{ input: number; output: number; cached: number } | null>(null);

  // Перемикач режимів (залишаємо тільки STATEFUL)
  const [mode, setMode] = useState<GenerationMode>(GenerationMode.STATEFUL);

  // Один проект на чат
  const [projectId, setProjectId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Синхронізація режиму з сервісом
  useEffect(() => {
    setGenerationMode(mode);
  }, [mode]);

  const resetStateForNewSession = () => {
    resetSession(); // скидає і чат (для STATEFUL), і токен-аккумулятори
    setMessages([initialMessage]);
    setTokenCount(null);
    setProjectId(null);
  };

  const handleSendMessage = async (
    userMessage: string,
    _opts?: { expandFromTitle?: string } // залишено для сумісності
  ) => {
    if (!userMessage.trim()) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: userMessage,
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const response = await sendMessageToGemini(
        userMessage,
        true,
        true,
        projectId ?? undefined,
        {
          // У STATEFUL ця історія сервісом не передається в модель;
          // у FULL_HISTORY — необхідна (UI прибрано, логіка лишилась).
          allMessages: messages.map((m) => ({
            role: m.role === MessageRole.USER ? 'user' : 'assistant',
            content: m.content,
          })),
        }
      );

      // Кумулятивні токени (із сервісу)
      setTokenCount({
        input: response.inputTokens,
        output: response.outputTokens,
        cached: response.cachedTokens,
      });

      if (response.projectId && response.projectId !== projectId) {
        setProjectId(response.projectId);
      }

      const contentForChat = response.projectUrl
        ? `[Відкрити проєкт](${response.projectUrl})`
        : response.text?.trim() || 'Готово. Перевірте створену сторінку.';

      const newAssistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        content: contentForChat,
        sources: response.sources,
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const msg =
        (error?.response?.status ? `HTTP ${error.response.status}: ` : '') +
        (error?.message || String(error));
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: MessageRole.MODEL,
          content: `Вибачте, виникла помилка.\n\n**Деталі:** ${msg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }; // <-- чітке закриття handleSendMessage

  return (
    <div className="h-screen w-screen bg-gray-900 text-gray-100 flex font-sans">
      {/* Main Chat Panel */}
      <div className="flex-grow flex flex-col h-screen">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 space-y-8 py-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-gray-800 text-cyan-400">
                  <AssistantIcon className="h-6 w-6" />
                </div>
                <div className="max-w-xl p-4 rounded-2xl rounded-bl-lg bg-gray-700 text-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full animate-bounce bg-cyan-400 [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 rounded-full animate-bounce bg-cyan-400 [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 rounded-full animate-bounce bg-cyan-400" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>
        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>

      {/* Right Sidebar */}
      <aside className="w-96 flex-shrink-0 bg-gray-950 border-l border-gray-800 h-screen flex flex-col">
        {/* Mode Switcher */}
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-md font-semibold text-cyan-400 mb-3">Режим генерації</h3>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="genmode"
                checked={mode === GenerationMode.STATEFUL}
                onChange={() => setMode(GenerationMode.STATEFUL)}
              />
              <span>Stateful (ai.chats.create)</span>
            </label>

            {/* Прибрано Full History з UI, логіку залишено закоментованою для можливого повернення */}
            {/*
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="genmode"
                checked={mode === GenerationMode.FULL_HISTORY}
                onChange={() => setMode(GenerationMode.FULL_HISTORY)}
              />
              <span>Full History (без chat state)</span>
            </label>
            */}
          </div>

          {/* Кнопка reset прихована; логіку залишили закоментованою */}
          {/*
          <button
            onClick={resetStateForNewSession}
            className="mt-4 text-xs px-3 py-1 rounded-md bg-gray-800 hover:bg-gray-700"
          >
            Новий діалог (reset session)
          </button>
          */}
        </div>

        {/* Token Usage */}
        <div className="p-6">
          <h3 className="text-md font-semibold text-cyan-400 mb-3">Використання токенів</h3>
          {tokenCount ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Input Tokens:</span>
                <span className="font-mono bg-gray-800 px-2 py-1 rounded-md text-gray-200">
                  {tokenCount.input}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Output Tokens:</span>
                <span className="font-mono bg-gray-800 px-2 py-1 rounded-md text-gray-200">
                  {tokenCount.output}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Cached Tokens:</span>
                <span className="font-mono bg-gray-800 px-2 py-1 rounded-md text-gray-200">
                  {tokenCount.cached}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                * Cached - кількість токенів, відданих з кешу (usageMetadata.cachedContentTokenCount).
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Інформація про токени з’явиться після першого запиту.</p>
          )}
        </div>
      </aside>
    </div>
  );
};

export default App;
