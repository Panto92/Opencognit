<div align="center">

![OpenCognit: You think. They build.](docs/img/banner.jpg)

# OpenCognit

**Every coding agent. One window.**

Run Claude Code, Codex, Gemini CLI, Kimi and Hermes side by side, let one of them orchestrate the others, and have every result checked before it reaches your project. Locally, with the subscriptions you already have.

[![Latest release](https://img.shields.io/github/v/release/OpenCognitOS/opencognit-releases?color=d8b46a&label=release)](https://github.com/OpenCognitOS/opencognit-releases/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/OpenCognitOS/opencognit-releases/total?color=d8b46a)](https://github.com/OpenCognitOS/opencognit-releases/releases)
[![Stars](https://img.shields.io/github/stars/Panto92/Opencognit?color=d8b46a)](https://github.com/Panto92/Opencognit/stargazers)
[![Discord](https://img.shields.io/badge/Discord-join%20us-5865F2?logo=discord&logoColor=white)](https://discord.gg/xASbhwdaS)
[![Website](https://img.shields.io/badge/website-opencognitos.github.io-d8b46a)](https://opencognitos.github.io)

**[⬇ Download for Linux](https://github.com/OpenCognitOS/opencognit-releases/releases/latest/download/OpenCognit-linux-x86_64.AppImage)** · **[⬇ Download for Windows](https://github.com/OpenCognitOS/opencognit-releases/releases/latest/download/OpenCognit-windows-setup.exe)** · [.deb](https://github.com/OpenCognitOS/opencognit-releases/releases/latest/download/OpenCognit-linux-amd64.deb) · [All releases](https://github.com/OpenCognitOS/opencognit-releases/releases) · [Deutsch](README.de.md)

</div>

![Grid of agent sessions](docs/img/grid.png)

> **This repository used to host the open-source OpenCognit agent platform.** That project is discontinued. Its code stays available under the MIT license in the [`legacy`](../../tree/legacy) branch. OpenCognit continues as the desktop app described here, which is a commercial product and not open source. This repository is now its public home: releases, issues, and discussion.

## What it does

- **Many agents, one place.** Real PTY sessions for each CLI, in a focus view or a grid. Several logins per CLI (work and private) stay separate.
- **An orchestrator that hands out work.** One agent starts others, gives each a numbered task and its own set of files, and is told when they report back. Agents cannot write outside their files, and two open tasks cannot overlap.
- **Guardrails before anything runs.** Every shell command an agent wants to run is checked against your rules: block, ask you, or warn. Commits are scanned for secrets first.
- **See what is happening.** A live graph shows which agent reads or changes which file and warns when two work in the same place.
- **Work that survives.** Sessions resume after a restart, checkpoints let you jump back, scheduled and overnight tasks run in their own worktree and leave a report.
- **Your usage, added up.** Tokens of all CLIs from their local logs, per day, model and project.


## A look inside

![Neurons](docs/img/neurons.webp)

Neurons: every agent is a ring at the folder it works in. Pulses run along the branches in the agent's colour when it reads or changes a file.

![The orchestrator hands out tasks and reports back what is done, what failed and what needs your decision.](docs/img/orchestrator.png)

The orchestrator hands out tasks and reports back what is done, what failed and what needs your decision.

![Guardrails](docs/img/guardrail.png)

Guardrails: a push to the remote waits for your approval.

![Cosmos](docs/img/cosmos.png)

Cosmos: the project as a map, with every file an agent touched today.

![Editor](docs/img/editor.png)

Editor: read and change the project's files without leaving the app.

## Privacy

OpenCognit runs on your machine and uses the subscriptions you already have with each CLI vendor. It has no server of ours in the loop and sends no telemetry. The event log stays in a local database; full terminal output is never stored in it. The app itself only goes online for a short, documented list of things: the update check, a package-name lookup on npm/PyPI before an agent installs something, and features you switch on yourself. The [full list](https://opencognitos.github.io/docs/en/security) says when, where and what, so you can check it with a firewall such as OpenSnitch or Portmaster.

## Price

- **Free:** up to 4 sessions at the same time.
- **Full version:** 69 € once, including 12 months of updates. The licence is checked offline.

## Install

Download the installer for your system from the [latest release](https://github.com/OpenCognitOS/opencognit-releases/releases/latest):

| System | File |
|---|---|
| Linux | `OpenCognit-linux-x86_64.AppImage` or `OpenCognit-linux-amd64.deb` |
| Windows | `OpenCognit-windows-setup.exe` |

You need at least one of the supported CLIs installed and logged in. The setup assistant finds them on first start.

## Questions and problems

- **Something broken?** [Open an issue](../../issues/new/choose).
- **An idea or a question?** Use [Discussions](../../discussions) or join the [Discord](https://discord.gg/xASbhwdaS).

## Licence

OpenCognit Desktop is proprietary software, © OpenCognit. The former open-source project in the `legacy` branch remains under the MIT license.
