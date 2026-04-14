class GeminiInputWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const opts = options.processorOptions || {};
    this.targetSampleRate = opts.targetSampleRate || 16000;
    this.chunkSamples = opts.chunkSamples || 320;

    this.sourceSampleRate = sampleRate;
    this.ratio = this.sourceSampleRate / this.targetSampleRate;

    this.inputBuffer = [];
    this.readPos = 0;

    this.outChunk = new Int16Array(this.chunkSamples);
    this.outIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];

    for (let i = 0; i < channel.length; i++) {
      this.inputBuffer.push(channel[i]);
    }

    while (this.readPos + 1 < this.inputBuffer.length) {
      const i0 = Math.floor(this.readPos);
      const frac = this.readPos - i0;
      const s0 = this.inputBuffer[i0];
      const s1 = this.inputBuffer[i0 + 1];
      const sample = s0 + (s1 - s0) * frac;

      const clipped = Math.max(-1, Math.min(1, sample));
      this.outChunk[this.outIndex++] =
        clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff;

      if (this.outIndex === this.chunkSamples) {
        const chunk = new Int16Array(this.outChunk);
        this.port.postMessage(chunk.buffer, [chunk.buffer]);
        this.outChunk = new Int16Array(this.chunkSamples);
        this.outIndex = 0;
      }

      this.readPos += this.ratio;
    }

    const consumed = Math.floor(this.readPos);
    if (consumed > 0) {
      this.inputBuffer = this.inputBuffer.slice(consumed);
      this.readPos -= consumed;
    }

    return true;
  }
}

registerProcessor("gemini-input-worklet", GeminiInputWorklet);
