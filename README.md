<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" alt="Tunnelo">
</p>

<h1 align="center">Tunnelo</h1>

<p align="center">
  A lightweight SSH tunnel manager for Windows, built with Tauri and Next.js.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-blue" alt="Platform">
  <img src="https://img.shields.io/badge/tauri-v2-orange" alt="Tauri v2">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

## Features

- **Local & Remote port forwarding** — SSH `-L` and `-R` tunnels
- **Password & Private Key authentication**
- **System tray** — Close the window to minimize; right-click the tray icon for quick actions
- **Auto-start tunnels** — Mark tunnels to start automatically when the app launches
- **Start/Stop All** — One-click control for all tunnels from the tray menu
- **Real-time status & logs** — Live connection status and log output per tunnel
- **Persistent configuration** — Tunnels are saved to disk and restored on launch
- **Test connection** — Validate SSH credentials before starting a tunnel

## Screenshot

<!-- TODO: Add a screenshot of the app here -->

## Installation

Download the latest installer from the [Releases](../../releases) page:

| Format | Description |
|--------|-------------|
| `Tunnelo_x.x.x_x64-setup.exe` | NSIS installer (recommended) |
| `Tunnelo_x.x.x_x64_en-US.msi` | MSI installer |

## Building from source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [NASM](https://www.nasm.us/) — required for crypto compilation on Windows
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with C++ workload

### Steps

```bash
# Clone the repository
git clone https://github.com/madaraXor/Tunnelo.git
cd tunnelo

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

The build artifacts will be in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri v2](https://v2.tauri.app/) |
| Frontend | [Next.js](https://nextjs.org/) (static export), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/) |
| State Management | [Zustand](https://zustand.docs.pmnd.rs/) |
| Backend | Rust with [russh](https://github.com/warp-tech/russh) for SSH |
| Async Runtime | [Tokio](https://tokio.rs/) |

## Project Structure

```
tunnelo/
├── app/                    # Next.js frontend
│   ├── components/         # React components (Sidebar, TunnelCard, TunnelForm...)
│   ├── hooks/              # Custom hooks (useTunnelEvents)
│   └── store/              # Zustand store
├── components/ui/          # shadcn/ui components
├── src-tauri/              # Tauri / Rust backend
│   ├── src/
│   │   ├── lib.rs          # App setup, tray, window events, auto-start
│   │   ├── commands.rs     # Tauri IPC commands
│   │   ├── models.rs       # Data structures
│   │   └── tunnel_manager.rs # SSH tunnel lifecycle
│   ├── icons/              # App icons (all sizes)
│   └── tauri.conf.json     # Tauri configuration
└── package.json
```

## Usage

1. **Add a tunnel** — Click "+" in the sidebar, fill in SSH and forwarding details
2. **Start/Stop** — Use the Play/Stop buttons on the tunnel detail card
3. **Auto-start** — Check "Start on app launch" in the tunnel form
4. **System tray** — Close the window to minimize to tray; double-click the icon to restore
5. **Tray menu** (right-click) — Show, Start All, Stop All, Quit

> **Note:** "Quit" from the tray menu will gracefully stop all active tunnels before exiting.

## License

MIT
