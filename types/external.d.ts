declare module "@met4citizen/talkinghead" {
  export class TalkingHead {
    constructor(container: HTMLElement, options?: Record<string, unknown>);
    showAvatar(options: Record<string, unknown>): Promise<void>;
    start(): void;
    speakAudio(audioData: unknown, options?: Record<string, unknown>): Promise<void>;
    [key: string]: unknown;
  }
}

declare module "@met4citizen/headtts" {
  export class HeadTTS {
    constructor(config: Record<string, unknown>);
    connect(): Promise<void>;
    setup(config: Record<string, unknown>): Promise<void>;
    synthesize(config: Record<string, unknown>): Promise<Array<{ type: string; data: any }>>;
  }
}
