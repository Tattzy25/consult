class GeminiOutputWorklet extends AudioWorkletProcessor {
  constructor() {
    super();

    this.queue = [];
    this.current = null;
    this.currentIndex = 0;
    this.queuedSamples = 0;
    this.didUnderrun = false;

    this.port.onmessage = (event) => {
      const data = event.data;

      if (data?.type === "flush") {
        this.queue = [];
        this.current = null;
        this.currentIndex = 0;
        this.queuedSamples = 0;
        this.didUnderrun = false;
        return;
      }

      if (data?.type === "chunk" && data.buffer) {
        const chunk = new Int16Array(data.buffer);
        this.queue.push(chunk);
        this.queuedSamples += chunk.length;
        this.didUnderrun = false;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const ch0 = output[0];

    for (let i = 0; i < ch0.length; i++) {
      if (!this.current || this.currentIndex >= this.current.length) {
        this.current = this.queue.length ? this.queue.shift() : null;
        this.currentIndex = 0;
      }

      if (this.current) {
        ch0[i] = this.current[this.currentIndex++] / 32768;
        this.queuedSamples--;
      } else {
        ch0[i] = 0;
      }
    }

    if (!this.current && this.queue.length === 0 && !this.didUnderrun) {
      this.didUnderrun = true;
      this.port.postMessage({ type: "underrun" });
    }

    return true;
  }
}

registerProcessor("gemini-output-worklet", GeminiOutputWorklet);
