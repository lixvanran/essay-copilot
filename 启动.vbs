' Zuowen Co-Pilot Launcher (vbs)
' One-click startup. Bypasses .bat file association issues.

Set WshShell = CreateObject("WScript.Shell")
scriptDir = Replace(WScript.ScriptFullName, WScript.ScriptName, "")
WshShell.Run "cmd.exe /K cd /d """ & scriptDir & """ && node start.js", 1, False
