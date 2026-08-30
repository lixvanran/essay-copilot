' Zuowen Co-Pilot Diagnostic (vbs)
' Bypasses .bat file association issues.

Set WshShell = CreateObject("WScript.Shell")
scriptDir = Replace(WScript.ScriptFullName, WScript.ScriptName, "")
WshShell.Run "cmd.exe /K cd /d """ & scriptDir & """ && node diag.js && notepad diagnose.txt", 1, True
