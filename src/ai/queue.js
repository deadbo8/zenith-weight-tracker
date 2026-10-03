/**
 * AI Offline Request Queue (Section 6.5 & Task D1)
 * Queues meal drafts / chat requests when offline and retries on reconnect.
 */

import { generate } from './geminiClient.js';
import { validateAiResponse, parseRawAiResponse } from './validate.js';
import { SYSTEM_NUTRITION, PROMPT_VERSION } from './prompts.js';
import { RESPONSE_SCHEMA } from './schema.js';
import { setCachedAiResult } from './cache.js';

class AiQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.listeners = new Set();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(event, data) {
    for (const fn of this.listeners) {
      try { fn(event, data); } catch (e) { console.error('Queue listener error', e); }
    }
  }

  enqueue(item) {
    const queueItem = {
      id: item.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'queued',
      model: item.model || 'gemini-3.5-flash',
      contents: item.contents,
      system: item.system || SYSTEM_NUTRITION,
      schema: item.schema || RESPONSE_SCHEMA,
      cachePayload: item.cachePayload,
      retries: 0,
      metadata: item.metadata || {}
    };

    this.queue.push(queueItem);
    this.notify('enqueued', queueItem);

    if (navigator.onLine) {
      this.processQueue();
    }

    return queueItem;
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const current = this.queue[0];
      try {
        this.notify('processing', current);

        const res = await generate({
          model: current.model,
          system: current.system,
          contents: current.contents,
          schema: current.schema
        });

        const parsed = parseRawAiResponse(res.text);
        const validated = validateAiResponse(parsed);

        if (current.cachePayload) {
          await setCachedAiResult({
            ...current.cachePayload,
            result: validated
          });
        }

        this.queue.shift();
        this.notify('completed', { item: current, result: validated });
      } catch (err) {
        current.retries = (current.retries || 0) + 1;
        if (err.kind === 'bad_key' || err.kind === 'blocked' || current.retries >= 3) {
          // Unrecoverable, remove from queue and notify error
          this.queue.shift();
          this.notify('failed', { item: current, error: err });
        } else {
          // Transient error: wait and pause processing
          this.notify('paused', { item: current, error: err });
          break;
        }
      }
    }

    this.isProcessing = false;
  }

  getPendingItems() {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
    this.notify('cleared', null);
  }
}

export const aiQueue = new AiQueue();
