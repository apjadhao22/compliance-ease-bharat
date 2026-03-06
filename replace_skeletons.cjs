const fs = require('fs');
const path = require('path');

const dashboardPath = path.join(__dirname, 'src', 'pages', 'dashboard');
const files = fs.readdirSync(dashboardPath).filter(f => f.endsWith('.tsx'));

let modifiedCount = 0;

for (const file of files) {
    const filePath = path.join(dashboardPath, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    const originalContent = content;
    const loaderPatterns = [
        /if\s*\(\s*loading\s*\)\s*return\s*<div[^>]*>\s*<Loader2[^>]*\/>\s*<\/div>\s*;/g,
        /if\s*\(\s*loading\s*\)\s*return\s*<div[^>]*>\s*<Loader2[^>]*><\/Loader2>\s*<\/div>\s*;/g
    ];

    let matched = false;
    for (const pattern of loaderPatterns) {
        if (pattern.test(content)) {
            matched = true;
            content = content.replace(pattern, 'if (loading) return <PageSkeleton />;');
        }
    }

    if (matched) {
        if (!content.includes('import { PageSkeleton }')) {
            content = `import { PageSkeleton } from "@/components/PageSkeleton";\n` + content;
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${file}`);
        modifiedCount++;
    }
}

console.log(`Replaced loading states in ${modifiedCount} files.`);
