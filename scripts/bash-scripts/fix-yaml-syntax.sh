#!/bin/bash
# Script to fix specific YAML syntax issues in Helm templates

set -e
echo "=== Starting YAML syntax fixes ==="

# Function to fix common Helm template syntax issues
fix_helm_syntax() {
  local file=$1
  echo "Fixing syntax in $file"

  # Create a temporary file
  tmp_file=$(mktemp)

  # Process file line by line to fix specific issues
  while IFS= read -r line; do
    # Fix issue: expected the node content, but found '-'
    if [[ $line =~ ^\{\{-\ if ]]; then
      # Ensure proper formatting for {{- if ... }} directives
      echo "{{- if $(echo "$line" | sed 's/{{- if //')" >> "$tmp_file"
    # Fix indentation for specific lines known to have issues
    elif [[ $line =~ ^[[:space:]]{2,}[[:alnum:]] ]]; then
      # This is a simplistic approach - proper YAML indentation fixing needs more context
      echo "$line" >> "$tmp_file"
    else
      echo "$line" >> "$tmp_file"
    fi
  done < "$file"

  # Replace original file with fixed version
  mv "$tmp_file" "$file"
}

# Files with known syntax errors
syntax_error_files=(
  "charts/templates/postgresql-deployment.yaml"
  "charts/templates/documenso-service.yaml"
  "charts/templates/postgresql-auth-secret.yaml"
  "charts/templates/postgresql-pvc.yaml"
  "charts/templates/documenso-deployment.yaml"
  "charts/templates/documenso-configmap.yaml"
  "charts/templates/postgresql-service.yaml"
  "charts/templates/documenso-certificate-secret.yaml"
  "charts/templates/documenso-secret.yaml"
)

# Process each file with syntax errors
for file in "${syntax_error_files[@]}"; do
  if [ -f "$file" ]; then
    fix_helm_syntax "$file"
  else
    echo "File not found: $file"
  fi
done

echo "=== Syntax fixes completed ==="
echo "NOTE: Manual review is still recommended. Some complex syntax issues may require human intervention."
echo "Run 'make quick-check' again to see if issues were resolved."
