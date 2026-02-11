# Lluc Llum Production Guide

## 1. System Preparation
For a robust installation, configure the macOS system as follows:

- **Disable Sleep**: 
  - System Settings > Energy Saver > "Prevent your Mac from automatically sleeping when the display is off".
  - Turn off "Put hard disks to sleep when possible".
- **Hide Dock/Menubar**: 
  - System Settings > Desktop & Dock > "Automatically hide and show the Dock" (Always).
  - System Settings > Control Center > "Automatically hide and show the menu bar" (Always).
- **Cursor Hiding**: Use a tool like [Cursorcer](https://doomlaser.com/cursorcer/) or simply move the mouse to a corner if not using touch input.

## 2. Launching in Production Mode
Use the new robust start script. This script will automatically restart the python server if it crashes.

```bash
./start.sh
```

## 3. Launching the Display (Kiosk Mode)
We recommend using **Google Chrome** in Kiosk mode for the best performance and stability.

1. **Quit Chrome completely** (Cmd+Q).
2. Run the following command in Terminal to launch Chrome in Kiosk mode pointing to the local server.

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --kiosk \
    --incognito \
    --disable-translate \
    --no-first-run \
    --check-for-update-interval=31536000 \
    http://localhost:8050
```

> **Note**: To exit Kiosk mode, press `Cmd+Q` or `Alt+F4` (if on Windows/Linux).

## 4. Troubleshooting
- **Logs**: Check `server.log` in the project directory for backend errors.
- **Manual Restart**: If the server loop gets stuck, press `Ctrl+C` in the terminal running `./start.sh`.
- **Developer Mode**: To run without auto-restart (useful for testing):
  ```bash
  ./start.sh --dev
  ```

## 5. Sound Setup (Multi-Channel Mic)
The installation supports a 4-channel microphone setup (e.g., Boya interface).

1.  **Connect Hardware**: Plug in your USB microphone/interface.
2.  **Verify System Settings**:
    *   Open **Audio MIDI Setup** on macOS (cmd+space -> "Audio MIDI Setup").
    *   Select your USB device in the left sidebar.
    *   Ensure "Input" format is set to **4 ch** (or more). If it defaults to 2ch, the browser will only receive a stereo mix!
3.  **In-App Configuration**:
    *   Click "Start Live Mic" on the interface.
    *   A dropdown will appear. Select your USB device.
    *   **Check the indicator**: You should see `(4 ch)` in grey text.
    *   **Mapping Mode**: If you see "4 ch" but the mics still mix together, try changing the mapping mode dropdown:
        *   **Direct**: Default. 1 mic = 1 qubit.
        *   **Force Stereo Pairs**: Forces Q0/Q2 to Left and Q1/Q3 to Right. Useful if the browser sees 4ch but the OS is just copying a Stereo Left/Right pair.
        *   **Mics A & C** -> Drive Qubits 0 & 2.
        *   **Mics B & D** -> Drive Qubits 1 & 3.
        *   This allows all 4 mics to work, but they are paired. This is a hardware limitation of the USB receiver.
    *   **Troubleshooting Crosstalk**: If you see `(4 ch)` but one mic triggers all qubits:
        1. Open **Audio MIDI Setup**.
        2. Select your device.
        3. Click "Configure Speakers" (even though it's a mic).
        4. Ensure it's set to "Quadraphonic" or "4.0 Surround", NOT "Stereo".
        5. If the OS forces a Stereo mix up to 4 channels, try using the "Bridged Mode" logic by forcing the browser to request 2 channels (currently not exposed in UI, but good to know).
        6. **Verify Hardware**: Some versions of the Boya BY-V4 *only* output a mixed stereo signal over USB. In this case, true 4-channel isolation is impossible, but the visualization will still look dynamic (just correlated).

