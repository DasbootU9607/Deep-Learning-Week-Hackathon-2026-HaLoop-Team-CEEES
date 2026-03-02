$env:PATH = 'C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs;' + $env:PATH
Set-Location 'C:\Users\Bill Zhang\Desktop\webfrontend\guardian-web'

# Install additional deps needed for shadcn
npm install tailwindcss-animate @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-switch @radix-ui/react-badge @radix-ui/react-avatar @radix-ui/react-popover @radix-ui/react-checkbox @radix-ui/react-slider 2>&1

Write-Host "Additional dependencies installed"
