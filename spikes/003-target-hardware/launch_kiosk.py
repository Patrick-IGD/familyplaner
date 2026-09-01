#!/usr/bin/env python3
import os

from pi_kiosk_probe import build_kiosk_command

origin = os.environ.get("FAMILYBOARD_ORIGIN", "")
chromium = os.environ.get("FAMILYBOARD_CHROMIUM", "/usr/bin/chromium")
runtime_directory = os.path.join(
    os.environ.get("XDG_RUNTIME_DIR", ""), "familyboard-kiosk"
)
if not os.path.isfile(chromium) or not os.access(chromium, os.X_OK):
    raise SystemExit("configured Chromium executable is unavailable")

os.execv(chromium, build_kiosk_command(chromium, origin, runtime_directory))
