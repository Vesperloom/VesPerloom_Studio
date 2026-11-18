# Security and privacy

Vesperloom is a **self-hosted, invite-only creative tool**. Default or legacy-token mode is a shared workspace. Optional named keys isolate media, galleries and jobs at the application layer. Local administrators, installed dependencies and the filesystem are trusted. There is no self-service signup, billing, content moderation, distributed isolation or internet-facing abuse prevention. Expose it only behind an appropriate network boundary.

- Keep the default loopback bind. Use an SSH tunnel or a TLS reverse proxy with strong workspace keys (or a shared token for one trusted group) and rate limits.
- Treat generated images, prompts, gallery records and replay capsules as private until you choose to share them. There is no telemetry. External chat is opt-in: selecting a configured remote endpoint sends that turn and its included history to that provider. Native GGUF chat stays on your server. Chat exports, motion recipes and image capsules can all contain private text.
- Do not commit workspace access tokens, `accounts.json`, `HF_TOKEN`, `VESPER_TOKEN`, `VESPER_CHAT_API_KEY`, `.env` files, personal snapshots or runtime data. The installer and inference worker have different responsibilities; credentials used for downloads are not forwarded to the worker.
- Use official pinned model profiles and trusted package sources. The installer checks content identity; hashes do not by themselves establish license rights, model quality or safety.
- Limit filesystem permissions, worker resources and available disk space on shared VPS hosts. Keep Node, Python and tensor libraries patched for your deployment.

Seed Lab is a static browser-only demo. Its portable codes contain bounded scene parameters only; configuring a public demo never exposes your studio. Telegram links navigate only on an explicit click. If deployed separately, scope Pages permissions to the supplied static workflow.

Report sensitive issues using the repository's private security advisory channel if the owner has enabled it; otherwise contact the maintainer privately. Do not attach real secrets, private prompts or user images to public issues.
