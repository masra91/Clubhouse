import React, { useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import { marked } from 'marked';
import type { VoiceTranscriptEntry } from '../../../../../shared/voice-types';
import { voiceState } from '../state';

function useTranscript(): VoiceTranscriptEntry[] {
  const subscribe = useCallback((cb: () => void) => voiceState.subscribe(cb), []);
  const getTranscript = useCallback(() => voiceState.transcript, []);
  return useSyncExternalStore(subscribe, getTranscript);
}

function MessageBubble({ entry }: { entry: VoiceTranscriptEntry }) {
  const isUser = entry.role === 'user';

  const html = useMemo(() => {
    if (isUser || !entry.text) return null;
    return marked.parse(entry.text, { async: false }) as string;
  }, [entry.text, isUser]);

  return React.createElement('div', {
    className: `flex ${isUser ? 'justify-end' : 'justify-start'}`,
  },
    React.createElement('div', {
      className: `max-w-[80%] px-3 py-2 rounded-lg text-sm ${
        isUser
          ? 'bg-ctp-blue text-white rounded-br-sm'
          : 'bg-ctp-surface0 text-ctp-text rounded-bl-sm'
      }`,
    },
      isUser
        ? React.createElement('p', { className: 'whitespace-pre-wrap' }, entry.text)
        : React.createElement('div', {
            className: 'voice-markdown prose prose-sm prose-invert max-w-none',
            dangerouslySetInnerHTML: { __html: html || '' },
          }),
      React.createElement('span', {
        className: `block mt-1 text-xs ${
          isUser ? 'text-white/60' : 'text-ctp-subtext0'
        }`,
      }, new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    ),
  );
}

export function TranscriptView() {
  const transcript = useTranscript();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  if (transcript.length === 0) {
    return React.createElement('div', {
      className: 'flex-1 flex items-center justify-center text-ctp-subtext0 text-sm',
    }, 'Hold the button and speak to start a conversation.');
  }

  return React.createElement('div', { className: 'flex-1 overflow-y-auto px-4 py-3 space-y-3' },
    transcript.map((entry, i) =>
      React.createElement(MessageBubble, { key: i, entry }),
    ),
    React.createElement('div', { ref: bottomRef }),
  );
}
