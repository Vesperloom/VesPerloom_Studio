# Publish the source on GitHub

The release archive contains a repository directory, **not** a preconfigured remote. No repository, account or public visibility setting is created automatically.

1. Extract the archive and enter `vesperloom/`. Review the MIT license, third-party notices, model card and README translations. The original weight shards are small enough for ordinary Git. No Git LFS setup is needed for the bundled content.
2. Run `npm ci && npm test && npm run build`. Optionally run `npm run registry:check` (upstream metadata only) and `npm run test:browser` after installing Chromium for Playwright.
3. Make sure `.env`, access tokens, external model weights, runtime galleries, virtual environments and `node_modules` are not staged. Reference media under `app/public/studies/` and `app/public/reels/` **are** intentional release assets. Do not stage GGUF files, account key registries, private clips or chat transcripts. User images and capsules may contain private prompts.
4. Create an **empty** repository in your own GitHub account, choose **Public** only if intended, and copy its HTTPS or SSH URL. Do not initialize a second README or license in the remote.
5. For a newly extracted directory:

```bash
git init -b main
git add .
git status --short            # Review the exact files before committing.
git commit -m "Release Vesperloom image, motion and chat studio"
# Set REPO_URL to the URL copied from your own empty repository.
git remote add origin "$REPO_URL"
git push -u origin main
```

If this is already a clone, do not reinitialize it or overwrite its existing remote. The default README is English and links to German, Russian and Simplified Chinese editions. Included artwork and source documentation use repository-relative paths. Configure the actual public repository and demo URLs for your fork before promoting it.

**Suggested repository description:** Self-hosted AI studio for images, video and chat. Turn a prompt into a landscape, direct a moving shot, and replay its recipe on your own server.

**Suggested topics:** `image-generation`, `video-generation`, `gguf`, `llama-cpp`, `diffusion-models`, `react`, `nodejs`, `self-hosted`, `generative-art`, `model-runner`.

To create a clean release archive from a reviewed commit, without dependency or runtime directories:

```bash
git archive --format=zip --prefix=vesperloom/ --output=../Vesperloom-source.zip HEAD
```

## Public browser demo and community links

The [Seed Lab launch guide](LAUNCH.md) covers GitHub Pages, the repository's social preview, Telegram launch copy, and enabling links with the **actual** repository URL. The shipped channel is [@vesperloom7](https://t.me/vesperloom7). Public demo deployment is opt-in and separate from hosting the private studio.
