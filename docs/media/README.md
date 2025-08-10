# Demo Media

This directory contains demo materials showcasing the AI Changelog Generator in action.

## Available Demos

### 🎬 Interactive Mode Demo

- **File**: `demo-interactive-optimized.gif`
- **Description**: Shows the full interactive mode experience with provider selection, commit analysis, and changelog generation
- **Duration**: ~30 seconds
- **Showcases**: Interactive CLI, provider setup, guided changelog creation

### ⚡ Quick Generation Demo  

- **File**: `demo-quick-real.gif`
- **Description**: Demonstrates rapid changelog generation from recent commits
- **Duration**: ~15 seconds
- **Showcases**: Fast CLI execution, automatic analysis, professional output

### 📺 Complete Video Walkthrough

- **File**: `demo-interactive.mp4`
- **Description**: Full-featured video demonstration of capabilities and use cases
- **Duration**: Extended walkthrough
- **Showcases**: Complete feature set, real-world usage scenarios

## VHS Tape Scripts

The `.tape` files are [VHS](https://github.com/charmbracelet/vhs) recording scripts used to generate the demo GIFs:

- `demo-interactive.tape` - Script for interactive mode demo
- `demo-quick-real.tape` - Script for quick generation demo

## Usage in Documentation

These media files are referenced in:

- Main `README.md` - Demo section with embedded GIFs
- Documentation guides - Visual examples of tool usage
- Marketing materials - Showcasing tool capabilities

## Regenerating Demos

To regenerate the demo GIFs using VHS:

```bash
# Install VHS
go install github.com/charmbracelet/vhs@latest

# Generate GIFs from tape scripts
vhs docs/media/demo-interactive.tape
vhs docs/media/demo-quick-real.tape
```

## File Sizes

- `demo-interactive-optimized.gif`: ~886KB (optimized for web)
- `demo-interactive.gif`: ~1.2MB (high quality)  
- `demo-quick-real.gif`: ~272KB
- `demo-interactive.mp4`: ~610KB
