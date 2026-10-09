-- Optional Terminal launcher: osascript launcher.applescript /path/to/territory-atlas
on run argv
  if (count of argv) is not 1 then
    error "Provide the Territory Atlas project folder, or open START_MAP.command directly."
  end if
  set projectDirectory to item 1 of argv
  tell application "Terminal"
    activate
    do script "cd " & quoted form of projectDirectory & " && ./START_MAP.command"
  end tell
end run
