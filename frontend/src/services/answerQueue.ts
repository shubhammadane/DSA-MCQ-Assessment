export type SavedAnswer = { question_number: number; selected_answer: string };
export type SaveState = 'saved' | 'saving' | 'offline';

// One request at a time prevents an older selection overwriting a newer one.
// Only changed answers are sent; failed batches remain queued for retry.
export class AnswerQueue {
  private pending = new Map<number, string>();
  private inFlight: Promise<void> | null = null;
  private send: (answers: SavedAnswer[]) => Promise<unknown>;
  private onState: (state: SaveState) => void;

  constructor(
    send: (answers: SavedAnswer[]) => Promise<unknown>,
    onState: (state: SaveState) => void,
  ) {
    this.send = send;
    this.onState = onState;
  }

  set(question: number, answer: string) {
    this.pending.set(question, answer);
    this.onState('saving');
  }

  flush(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.drain().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async drain() {
    while (this.pending.size) {
      const batch = new Map(this.pending);
      this.pending.clear();
      this.onState('saving');
      try {
        await this.send([...batch].map(([question_number, selected_answer]) => ({ question_number, selected_answer })));
      } catch (error) {
        for (const [question, answer] of batch) {
          if (!this.pending.has(question)) this.pending.set(question, answer);
        }
        this.onState('offline');
        throw error;
      }
    }
    this.onState('saved');
  }
}
