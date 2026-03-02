$env:PATH = 'C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs;' + $env:PATH
Set-Location 'C:\Users\Bill Zhang\Desktop\webfrontend\guardian-web'

# Install all dependencies
npm install @supabase/supabase-js@^2 @supabase/ssr@^0 @tanstack/react-query@^5 reactflow@^11 react-hook-form@^7 zod@^3 zustand@^4 dagre@^0.8 sonner@^1 @tanstack/react-query-devtools@^5 class-variance-authority clsx tailwind-merge lucide-react date-fns

# Install dev dependencies
npm install -D @types/dagre

Write-Host "Dependencies installed successfully"
