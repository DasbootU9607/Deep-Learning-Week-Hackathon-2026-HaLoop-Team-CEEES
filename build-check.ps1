$env:PATH = 'C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs;' + $env:PATH
Set-Location 'C:\Users\Bill Zhang\Desktop\webfrontend\guardian-web'
Write-Host "Running type check..."
npx tsc --noEmit 2>&1
Write-Host "Done"
