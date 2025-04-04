#!/bin/bash
# Script to fix common Helm chart YAML linting issues

set -e
echo "=== Starting Helm Chart YAML fixes ==="

# Add required icon to Chart.yaml if missing
if ! grep -q "icon:" charts/Chart.yaml; then
  echo "Adding icon URL to Chart.yaml"
  echo "icon: https://documenso.com/logo.png" >> charts/Chart.yaml
fi

# Process all template files to fix spacing
for file in charts/templates/*.yaml; do
  echo "Processing $file"
  # Fix spaces inside braces {{ var }} -> {{var}}
  sed -i '' -E 's/\{\{ +/{{/g' "$file"
  sed -i '' -E 's/ +\}\}/}}/g' "$file"
done

# Process values.yaml
echo "Processing values.yaml"
# Fix spaces inside braces {{ var }} -> {{var}}
sed -i '' -E 's/\{\{ +/{{/g' "charts/values.yaml"
sed -i '' -E 's/ +\}\}/}}/g' "charts/values.yaml"

# Create .helmignore if it doesn't exist
if [ ! -f charts/.helmignore ]; then
  echo "Creating .helmignore file"
  cat > charts/.helmignore << 'EOF'
# Patterns to ignore when building packages.
# This supports shell glob matching, relative path matching, and
# negation (prefixed with !).
.DS_Store
# Common VCS dirs
.git/
.gitignore
.bzr/
.bzrignore
.hg/
.hgignore
.svn/
# Common backup files
*.swp
*.bak
*.tmp
*.orig
*~
# Various IDEs
.project
.idea/
*.tmproj
.vscode/
EOF
fi

echo "=== Helm Chart fixes completed ==="
echo "NOTE: Some YAML indentation issues will still need to be fixed manually."
echo "Run 'make quick-check' again to see if issues were resolved."
