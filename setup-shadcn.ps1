$env:PATH = 'C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs;' + $env:PATH
Set-Location 'C:\Users\Bill Zhang\Desktop\webfrontend\guardian-web'

# Initialize shadcn-ui
Write-Host "Initializing Shadcn UI..."
$input = "y`ny`n0`nslate`ny`n@/*`ny`n" # auto-answer prompts
echo $input | npx --yes shadcn-ui@latest init 2>&1

Write-Host "Shadcn UI initialized"
