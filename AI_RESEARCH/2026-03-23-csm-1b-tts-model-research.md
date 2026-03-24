# Research: CSM-1B Text-to-Speech Model
Date: 2026-03-23

## Summary

CSM-1B (Conversational Speech Model, 1 billion parameters) is an open-weights speech generation model released by Sesame AI Labs in March 2025. It is designed for conversational contexts, supports multi-speaker generation, and produces notably natural-sounding speech. It is a Python-only local inference model with no official hosted API — though third-party hosted APIs exist (fal.ai, Replicate). Hardware requirements are modest (~4GB VRAM), but inference is slow (~17s on an L40S GPU). The model is licensed Apache 2.0.

## Prior Research
None on this topic.

## Current Findings

### 1. What Is CSM-1B and Who Made It?

- Made by **Sesame AI Labs** (sesameaivoice.com / sesame.com/research)
- Released: **March 13, 2025**
- Full name: Conversational Speech Model (CSM), 1 billion parameter variant
- Architecture: **Llama backbone** (1B parameters) + a smaller **audio decoder** (~100M parameters) that produces Mimi audio codes (Residual Vector Quantization / RVQ)
- Designed specifically for conversational contexts — uses prior dialogue turns (text + audio) to produce more coherent, natural speech
- Supports **multi-speaker generation** (distinct voices in a dialogue, identified by integer speaker IDs)
- Outputs 24kHz audio via Mimi audio codec
- Primary research goal: crossing the "uncanny valley" of voice AI

### 2. Open Source / Open Weights

- **License: Apache 2.0** — confirmed from the Hugging Face model card
- Model weights are publicly available on Hugging Face: `sesame/csm-1b`
- Source code is on GitHub: `SesameAILabs/csm`
- Gated model: requires agreeing to usage terms and having a Hugging Face account; a HF token is required at runtime
- Released as a **base model** (no fine-tuning to specific voices — voice characteristics vary per run without conditioning)
- GGUF quantized versions exist: `ggml-org/sesame-csm-1b-GGUF` (96.1M params — this is the audio decoder component only, used with `--model-vocoder` flag in llama.cpp)

### 3. How Is It Typically Run?

**Python, local GPU, official repo approach:**

```bash
git clone https://github.com/SesameAILabs/csm
cd csm
python3.10 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export NO_TORCH_COMPILE=1
huggingface-cli login
```

```python
from generator import load_csm_1b
generator = load_csm_1b(device="cuda")
audio = generator.generate(
    text="Hello from Sesame.",
    speaker=0,
    context=[],
    max_audio_length_ms=10_000,
)
```

**Transformers/HuggingFace approach** (as of transformers >= 4.52.1):

```python
from transformers import CsmForConditionalGeneration, AutoProcessor

model_id = "sesame/csm-1b"
processor = AutoProcessor.from_pretrained(model_id)
model = CsmForConditionalGeneration.from_pretrained(model_id, device_map="cuda")
inputs = processor("[0]Hello from Sesame.", add_special_tokens=True).to("cuda")
audio = model.generate(**inputs, output_audio=True)
processor.save_audio(audio, "output.wav")
```

Supports: CUDA (NVIDIA), MPS (Apple Silicon M-series), CPU (slow).
Python version: 3.10 recommended; newer may work.
Additional system dependency: `ffmpeg` may be required.
Windows: substitute `triton-windows` for `triton`.

### 4. Hardware Requirements

- **VRAM: ~4GB** — confirmed by darkmirage (project contributor) in GitHub issue #9 for the 1B model
- Tested on CUDA 12.4 and 12.6; other CUDA versions may work
- Supports CUDA graph compilation for acceleration (`cache_implementation = "static"`)
- Supports batched inference for multiple prompts
- An NVIDIA L4 (24GB) or L40S GPU is used in hosted benchmarks — significant overkill for 4GB model; consumer-grade 8GB cards (RTX 3070/4060) should work
- CPU inference is possible but would be significantly slower
- Apple Silicon (MPS) is supported in community implementations

### 5. Node.js SDK / API

**Official repo: Python-only. No Node.js SDK.**

Third-party options that provide REST APIs callable from Node.js:

| Option | Type | Node.js Callable | Notes |
|--------|------|-----------------|-------|
| **fal.ai** | Hosted API | Yes — `@fal-ai/client` npm package | GPU H100, queue-based |
| **Replicate** | Hosted API | Yes — Replicate Node.js client or REST | $0.016/run, ~17s latency |
| **sesame_csm_openai** (GitHub: phildougherty) | Self-hosted | Yes — OpenAI-compatible REST API | Docker + GPU required locally |
| **Chutes** | Hosted/self-hosted | Yes — standard HTTP REST | FastAPI endpoints |

The `sesame_csm_openai` project is the most practical self-hosted option — it exposes `POST /v1/audio/speech` (OpenAI-compatible), voice cloning, and conversation endpoints via Docker. Any Node.js HTTP client can call it directly.

### 6. Inference Latency

Latency data is limited but the picture is clear: CSM-1B is **slow for a TTS model**.

- **Replicate (L40S GPU):** "predictions typically complete within **17 seconds**" — with the caveat that timing varies by input length
- **fal.ai (H100 GPU):** Uses queue-based polling and webhooks, suggesting multi-second latency; "long-running requests" phrasing indicates non-trivial latency
- **Streaming reduction:** One source notes that streaming can reduce perceived latency from ~6 seconds to 1-2 seconds for first audio to play (for shorter utterances)
- No published RTF (real-time factor) figures from official sources

**Context:** edge-tts (Microsoft's cloud TTS) typically completes in ~200-500ms. Google Cloud TTS is under 1 second. CSM-1B at 17s on an H100-class GPU is orders of magnitude slower for synchronous use cases.

### 7. Hosted API Options

| Provider | URL | Pricing | Notes |
|----------|-----|---------|-------|
| **Replicate** | replicate.com/lucataco/csm-1b | $0.016/run (~62 runs/$1) | L40S GPU, ~17s/request |
| **fal.ai** | fal.ai/models/fal-ai/csm-1b | Not published | H100, queue-based |
| **HuggingFace Spaces** | huggingface.co/spaces/sesame/csm-1b | Free (demo) | Rate-limited, slow |
| **Cerebrium** | cerebrium.ai | Custom (serverless GPU) | Deploy-it-yourself |

No official Sesame-hosted API exists. All hosted options are community/third-party deployments.

### 8. Voice Quality vs edge-tts / Google Cloud TTS

**Strengths of CSM-1B:**
- Among open-source models, F5-TTS and CSM-1B are the "most well-rounded performers, achieving good performance in both synthesized speech quality and controllability" (Inferless benchmark on NVIDIA L4)
- Designed specifically for conversational naturalness — better prosody in dialogue contexts than traditional TTS
- Supports multi-speaker generation natively
- Emotional expressiveness is noted; described as more than standard TTS ("ElevenLabs free alternative" framing)
- Can use conversational history (prior audio + text) as context, improving coherence across turns

**Weaknesses vs cloud TTS:**
- Voice quality is described as not matching "expressive range of cloud models like ElevenLabs or Hume"
- **English only** — non-English performance is poor (officially acknowledged)
- No pre-trained specific voices — base model voice varies; requires audio conditioning/voice cloning for consistency
- 17s latency vs ~200-500ms for edge-tts and ~1s for Google Cloud TTS
- Requires significant infrastructure (GPU, Python, model download)

**Quality ranking (community consensus):**
- ElevenLabs > Google Cloud TTS (WaveNet/Neural2) > CSM-1B > edge-tts (Microsoft Azure Neural) > standard TTS
- CSM-1B excels in conversational naturalness specifically, while Google/ElevenLabs have broader voice variety and language coverage

## Key Takeaways

- CSM-1B is **not suitable as a low-latency TTS component** for real-time chat applications — 17s per utterance is unusable for synchronous voice generation
- It is **better suited to pre-generation, async voice synthesis**, or as a voice cloning base where latency is not critical
- For integration into a Node.js system (like Harness), the best path is: self-host `sesame_csm_openai` Docker container or call fal.ai/Replicate REST APIs via HTTP
- If low-latency voice output is needed, **edge-tts** (Python subprocess, ~200ms, free, no GPU) or **OpenAI TTS API** (~1-3s, $15/1M chars) are better choices
- CSM-1B's unique value proposition is **voice cloning from audio samples and multi-speaker conversational naturalness** — not speed
- The GGUF quantized version at llama.cpp may enable faster CPU inference, but no benchmarks are published

## Sources
- [sesame/csm-1b — Hugging Face model card](https://huggingface.co/sesame/csm-1b)
- [SesameAILabs/csm — GitHub repository](https://github.com/SesameAILabs/csm)
- [GitHub Issue #9: How much VRAM for 1B/3B/8B?](https://github.com/SesameAILabs/csm/issues/9)
- [fal.ai CSM-1B API documentation](https://fal.ai/models/fal-ai/csm-1b/api)
- [Replicate: lucataco/csm-1b](https://replicate.com/lucataco/csm-1b)
- [sesame_csm_openai — OpenAI-compatible wrapper](https://github.com/phildougherty/sesame_csm_openai)
- [ggml-org/sesame-csm-1b-GGUF](https://huggingface.co/ggml-org/sesame-csm-1b-GGUF)
- [Inferless: Comparing TTS models (12 models, L4 GPU)](https://www.inferless.com/learn/comparing-different-text-to-speech---tts--models-part-2)
- [Sesame research blog: Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice)
- [Chutes.ai TTS documentation](https://chutes.ai/docs/examples/text-to-speech)
