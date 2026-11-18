import { getLlama, LlamaLogLevel } from 'node-llama-cpp';
const llama = await getLlama({ gpu: false, build: 'never', logLevel: LlamaLogLevel.error });
console.log('CPU GGUF runtime ready.');
await llama.dispose();
