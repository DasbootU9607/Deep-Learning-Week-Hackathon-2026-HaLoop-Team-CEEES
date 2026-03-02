$env:PATH = 'C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs;' + $env:PATH
Set-Location 'C:\Users\Bill Zhang\Desktop\webfrontend'
Write-Host "Node: $(node --version)"
Write-Host "NPM: $(npm --version)"
npx create-next-app@14 guardian-web --typescript --tailwind --eslint --app --src-dir --import-alias '@/*' --no-git
