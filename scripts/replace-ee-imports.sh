#!/bin/bash

# This script replaces all imports from @documenso/ee with @documenso/ee-stub
# It is useful when forking the project and not having access to the Enterprise Edition features

echo "Replacing imports from @documenso/ee with @documenso/ee-stub..."

# Find all TypeScript/JavaScript files
find ./apps ./packages -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
    # Skip files in the ee-stub directory
    if [[ $file == *"/ee-stub/"* ]]; then
        continue
    fi

    # Replace @documenso/ee imports with @documenso/ee-stub
    sed -i '' 's|from "@documenso/ee/|from "@documenso/ee-stub/|g' "$file"
    sed -i '' "s|from '@documenso/ee/|from '@documenso/ee-stub/|g" "$file"
    sed -i '' 's|import "@documenso/ee/|import "@documenso/ee-stub/|g' "$file"
    sed -i '' "s|import '@documenso/ee/|import '@documenso/ee-stub/|g" "$file"

    echo "Updated: $file"
done

echo "Import replacement completed."
echo "Now run 'bun install' to ensure the new package is properly linked."
