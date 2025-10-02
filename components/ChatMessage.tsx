import React, { useState } from 'react';
// Note: You need to install react-markdown and remark-gfm for this component to work
// npm install react-markdown remark-gfm
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, MessageRole } from '../types';
import { AssistantIcon, UserIcon, ClipboardIcon, CheckIcon } from './Icons';
import SourceLink from './SourceLink';

interface ChatMessageProps {
  message: Message;
}

const CodeBlock: React.FC<{ content: string }> = ({ content }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-gray-900/80 p-4 rounded-lg overflow-x-auto text-sm text-gray-200 border border-gray-700">
        <code>{content}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 bg-gray-700 rounded-md text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 transition-all duration-200 opacity-0 group-hover:opacity-100"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-green-400" />
        ) : (
          <ClipboardIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;

  const containerClasses = `flex items-start gap-4 ${isUser ? 'justify-end' : ''}`;
  const bubbleClasses = `max-w-xl p-4 rounded-2xl ${
    isUser
      ? 'bg-cyan-600 text-white rounded-br-lg'
      : 'bg-gray-700 text-gray-200 rounded-bl-lg'
  }`;

  const Icon = isUser ? UserIcon : AssistantIcon;
  const iconContainerClasses = `flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
    isUser ? 'bg-gray-600 text-gray-200 order-2' : 'bg-gray-800 text-cyan-400'
  }`;

  // якщо контент — це наш спец-лінк "[Відкрити проєкт](...)"
  const projectUrlMatch = /^\[Відкрити проєкт\]\(([^)]+)\)/.exec(
    message.content.trim()
  );
  const isProjectLink = !!projectUrlMatch;
  const projectUrl = projectUrlMatch?.[1];

  return (
    <div className={containerClasses}>
      <div className={iconContainerClasses}>
        <Icon className="h-6 w-6" />
      </div>
      <div className={`${bubbleClasses} ${isUser ? 'order-1' : ''}`}>
        {isProjectLink ? (
          <a
            href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-2xl shadow-lg hover:scale-105 hover:shadow-xl transform transition-all"
          >
            <span className="mr-2">✨</span> Відкрити проєкт
          </a>
        ) : (
          <div className="prose prose-sm prose-invert prose-p:my-2 prose-headings:my-3 prose-li:my-1 prose-a:text-cyan-400 hover:prose-a:text-cyan-300">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: ({ node, ...props }) => {
                  const codeNode = node?.children[0];
                  if (
                    codeNode &&
                    'tagName' in codeNode &&
                    codeNode.tagName === 'code' &&
                    'children' in codeNode
                  ) {
                    const codeContent = codeNode.children[0];
                    if (codeContent && 'value' in codeContent) {
                      return (
                        <CodeBlock
                          content={String(codeContent.value).replace(/\n$/, '')}
                        />
                      );
                    }
                  }
                  return (
                    <pre {...props} className="bg-gray-800 p-2 rounded-md" />
                  );
                },
                table: ({ node, ...props }) => (
                  <table {...props} className="w-full text-left border-collapse" />
                ),
                thead: ({ node, ...props }) => (
                  <thead {...props} className="bg-gray-800" />
                ),
                th: ({ node, ...props }) => (
                  <th {...props} className="border border-gray-600 p-2" />
                ),
                td: ({ node, ...props }) => (
                  <td {...props} className="border border-gray-600 p-2" />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.sources && <SourceLink sources={message.sources} />}
      </div>
    </div>
  );
};

export default ChatMessage;