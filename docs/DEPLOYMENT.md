# Deploy on a VPS

## Native: smallest useful deployment

Start with a Linux VPS with **2 vCPUs and 2 GB RAM** as a practical initial size, not a promised minimum. Allow storage for dependencies and gallery output. Use a recent Node.js 22 release and npm 10 or newer.

```bash
npm ci
npm start
```

The service binds to `127.0.0.1:4173`. On your laptop, `ssh -L 4173:127.0.0.1:4173 user@your-vps` forwards that port; open `http://127.0.0.1:4173` locally. **Do not change the bind to a public interface just to view a remote studio.**

`npm start` builds the UI and then serves the API and static bundle on one port. For all three local desks on glibc Linux x86-64, insert `npm run chat:setup` between install and start. See [multimodal setup and hardware](MULTIMODAL.md). For managed deployments, run `npm ci --include=dev && npm run build` once, then `npm run serve`. A production-only install before the build omits Vite. There is no CDN or hosted inference requirement at runtime.

## Docker Compose

```bash
docker compose up -d --build
docker compose logs -f studio
```

The multi-stage image runs as a non-root user. Compose publishes **only** `127.0.0.1:4173`, uses a named volume for `/data`, drops Linux capabilities and enables a liveness probe. To stop without deleting saved work, use `docker compose down` **without `-v`**. The base image runs native images and video; it does not contain CUDA. On a glibc Linux amd64 Docker host, the opt-in build can also include the CPU chat runtime without baking any weights into an image:

```bash
WITH_LOCAL_CHAT=1 docker compose up -d --build
docker compose exec studio node bin/loom.mjs pull qwen-small
docker compose exec studio npm run workspace -- add mira  # optional; save the token privately
docker compose restart studio                             # apply keyring changes
```

With this container layout, run the **pull** command above rather than `chat:setup`; runtime installation happens at image build. A connected network chat endpoint can instead be configured through the three `VESPER_CHAT_*` Compose variables. Loopback inside a container refers to that container, not the host. These deployment templates were not executed against a Docker daemon in the release environment.

The included image runs the native visual engine. For a GPU host, follow [external model setup](EXTERNAL-MODELS.md); do not pull tens of gigabytes of weights into a native-only container expecting CUDA to appear.

## Environment

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `HOST`, `PORT` | `127.0.0.1`, `4173` | Production listener |
| `VESPER_HOME` | `.vesperloom/` under the repository | Model installs and persistent render records |
| `VESPER_TOKEN` | Unset | Enables bearer access to the single shared workspace; ignored if a named registry exists |
| `VESPER_PYTHON` | `python3` (`python` on Windows) | Absolute path recommended for the optional tensor runtime |
| `VESPER_DEVICE` | `auto` | `auto`, `cpu` or `cuda` for external jobs |
| `VESPER_ALLOW_CPU_EXTERNAL` | Unset | Set `1` to deliberately allow an external pipeline on CPU |
| `VESPER_OFFLOAD` | Unset | Set `1` to enable model CPU offload on CUDA |
| `VESPER_CHAT_BASE_URL`, `VESPER_CHAT_MODEL` | Unset | Optional OpenAI-compatible chat service base and exact model ID |
| `VESPER_CHAT_API_KEY` | Unset | Credential used only by the server for the configured chat service |
| `HF_TOKEN` | Unset | Authorized token for the **installer** if upstream requires it |

Export variables in the shell or define them in your service manager. The Node process does **not** automatically load `.env` files. Read-only static study images and `/api/health` are public; custom renders are protected when token authentication is enabled. The UI keeps a supplied token in memory and asks again on refresh.

## Long-running service

[`deploy/vesperloom.service`](../deploy/vesperloom.service) is a systemd example. Create a dedicated `vesperloom` account, install and build the repository under `/opt/vesperloom`, verify the Node binary path (`/usr/bin/node` in the example), and keep secrets in a root-readable `/etc/vesperloom.env`. The unit creates `/var/lib/vesperloom` for state. The service account must be able to read the built UI and write its state directory. Use the same state path for CLI model installation.

Do not expose an anonymous studio. For invited users, [issue one named key per workspace](MULTIMODAL.md#invite-only-private-workspaces); a shared `VESPER_TOKEN` alone does not isolate data. Use TLS and a rate-limiting reverse proxy, keep the upstream port private and apply a disk quota. Disable proxy response buffering on `/api/chat` (e.g. `proxy_buffering off;` in nginx) and set its read timeout above 180 seconds so text can stream. The CLI and filesystem are trusted administrator interfaces, not a sandbox for mutually hostile server operators.

## Persistence and recovery

- `models/<id>/`: committed upstream components plus receipt. A `.staging/` suffix denotes an incomplete installation.
- `renders/<uuid>/`: PNG, thumbnail, capsule and gallery metadata. `renders/.work-*` is scratch space.
- `clips/<uuid>/`: MP4, WebM review copy, poster, frame strip, recipe and metadata. In named mode both `renders/` and `clips/` are below `workspaces/<id>/`; `models/` stays global. Back up the key registry privately.
- One active visual worker, eight queued jobs, 20-minute deadline, 64 images and 16 clips per workspace; one concurrent 180-second chat stream. A restart recovers complete records but not running or queued jobs.
- Back up the volume with the server stopped. Export important PNGs/capsules elsewhere before the retention window rolls them off. Only one server may own a given `VESPER_HOME`.
- Native cold start needs only the shipped 58,448 bytes of neural weights. It never falls back to a fake image on failure: jobs surface an error.

## Common problems

| Symptom | Check |
| :--- | :--- |
| A remote browser cannot open `localhost` | Use the SSH tunnel on the computer running the browser. |
| `File not found` at `/` | Build the UI; use `npm start` or `npm run build && npm run serve`. |
| A model is still grayed out | Verify with the CLI under the same `VESPER_HOME`, then reload the studio. |
| No CUDA or `ModuleNotFoundError` | Set `VESPER_PYTHON` to the environment that has matching Torch, torchvision and Diffusers. Restart the service with that environment. |
| Pull denied by upstream | Review the model terms, get access if required and supply your own `HF_TOKEN`. |
| Replay digest differs | Check the exact engine version, manifest, checkpoint, settings and hardware. A GPU seed is not a cross-platform bit-exact guarantee. |
