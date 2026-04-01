# At Windows logon: wait for WSL, then keep a WSL session alive running the Actions runner.
# Used by Scheduled Task "GitHubActionsRunnerWSL".
$ErrorActionPreference = 'Stop'
Start-Sleep -Seconds 90
& "$env:SystemRoot\System32\wsl.exe" -d Ubuntu -- bash -lc 'cd ~/actions-runner && exec ./run.sh'
