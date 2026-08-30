' Zuowen Co-Pilot Stop (vbs)
' Bypasses .bat file association issues.

Set WshShell = CreateObject("WScript.Shell")
scriptDir = Replace(WScript.ScriptFullName, WScript.ScriptName, "")
WshShell.Run "cmd.exe /K cd /d """ & scriptDir & """ && node stop.js && pause", 1, False
