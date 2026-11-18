# Launch the Seed Lab

Give someone a landscape they can change **before** asking them to install the studio. Seed Lab runs the real Strata-1 renderer and weights in a browser worker. Its single HTML file also works offline. No account, bot, traffic tracker, inference proxy or public VPS is needed.

**Project channel:** [Telegram · @vesperloom7](https://t.me/vesperloom7). This is a link to the channel, not a bot integration. Vesperloom never joins a channel, sends a message or stars a repository on anyone’s behalf.

## 1 · Give visitors a real demo URL

1. Publish the source to **your** repository using [the publishing checklist](PUBLISHING.md).
2. In that repository, select **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Open **Actions → Publish Seed Lab → Run workflow** on the reviewed release branch. This opt-in workflow uploads only a static HTML page, its social preview and `.nojekyll`. It does not deploy the full studio, any gallery, prompts or tokens.
4. Use the **actual Pages URL shown by the deployment** as the repository's About → Website. The deployed demo has a **Star on GitHub** link to the actual repository, a direct channel link, and a share composer for Telegram. Nothing is posted until the visitor explicitly chooses to send it in Telegram.
5. Set `REPO_URL` and `DEMO_URL` in your shell to the real HTTPS addresses. Run the following locally, review the changes, and commit them. This wires the top of **all four READMEs** and the studio's star link; it does not make a network request or push anything.

```bash
npm run community:setup -- --repo "$REPO_URL" --demo "$DEMO_URL"
npm run build
npm test
```

There is no guessed owner or fake star counter. Until a repository is configured the star link is hidden. Until a public site is configured the portable demo copies a **seed code**, never a private host or `file://` URL. A local studio **Remix** action opens its own copy of the demo in a new tab; public links, when configured, use only the explicitly selected demo host.

For another static host, set `VESPER_REPOSITORY_URL` and `VESPER_DEMO_URL` at build time and run `npm run build:pages`. Publish the contents of `.output/pages/`. The default `npm run lab:build` instead writes **`app/public/seed-lab.html`**. The checked-in portable file also opens directly after extracting the source ZIP. Review settings and regenerate release assets when forking.

## 2 · Make the first post useful

[Watch the real seed-drift loop](media/seed-drift.gif) · [Preview the browser interface](media/seed-lab.jpg). The loop is drawn from nine actual CLI renders; `python tools/make_teaser.py` rebuilds it with Pillow. It is ready to attach to a channel announcement.

- Upload [`seed-lab-social.png`](media/seed-lab-social.png) as the repository social preview or attach it to a channel post. This is an actual render exported with the postcard button, not concept art. The PNG is 1200×630, with a reusable code printed in the margin.
- Attach the portable `seed-lab.html` to your GitHub release. Readers who cannot access Pages can download and open it without npm.
- Lead with **one action**: “Change the drift on this seed.” Link directly to the published remix rather than a long installation thread. Try the remix on a phone first.
- Pin the announcement in [your Telegram channel](https://t.me/vesperloom7). Share in relevant developer or generative-art communities only where project posts are welcome. One optional star invitation is enough.

**Copy-ready launch caption** (append the real remix URL and repository URL after publication):

> I built a landscape generator that fits in one HTML file. The model runs on your CPU, in your browser. Open Seed Lab, drag **Seed drift**, and send me a postcard of what you made. My starting point: `VL1.dunes.copper.3x2.41928.24.0.5`. The full React/Node studio is open source. If it earns a place in your toolkit, a GitHub star helps others find it. Releases: https://t.me/vesperloom7

## 3 · Give people a reason to return

**Weekly seed** chooses a common starting seed, family, palette and sky flags based on the Monday date in UTC. No scheduled task or database is involved. Each week, publish your own take with its `VL1` code and invite others to try one variation. Ask permission before reposting someone else's art; if the channel has no discussion enabled, don't instruct readers to reply there.

The code is deliberately **not a prompt**: it can encode only terrain family, palette, frame, numeric seed, steps, drift and three sky flags. It never serializes a private IP address, credential, image URL, raw prompt or parent ID. A social link is public to anyone it is sent to. The full studio's replay **capsules**, in contrast, contain prompts and should be reviewed before sharing. The optional postcard visibly includes the channel; original studio PNGs are unchanged.

Keep the About description concrete: *Offline browser image synthesis and a self-hosted studio with portable seed remixes.* Track useful signals using the repository's own traffic/referrer view and actual feedback. No release workflow can guarantee reach or star counts.

## Motion & chat release material

Attach the real [Meridian Crossing MP4](../app/public/reels/meridian/clip.mp4), its [motion recipe](../app/public/reels/meridian/recipe.json), or the [Video studio screenshot](media/motion.jpg). Say what generated it: *a camera moving inside a learned Strata landscape on CPU*. Do not label this sample as Wan output. A separate [local Qwen chat screenshot](media/chat.jpg) shows the language path. Pages is still the offline image Seed Lab, not a public chat/GPU backend. Keep the full studio behind your own access controls.
