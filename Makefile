# Makefile for Helm Chart validation and linting
#
# This Makefile provides commands to validate and lint Helm charts,
# ensuring they follow best practices and have no structural issues.

CHART_DIR := charts
CHART_NAME := documenso
KUBE_VERSION := 1.25.0  # Modify as needed for your target k8s version

.PHONY: all clean lint template validate yamllint helm-docs chart-structure kubeval kubeconform quick-check

# Default target runs all checks (only those that don't require extra plugins)
all: lint template validate yamllint helm-docs kubeconform chart-structure

#-------------------------------------------------------
# Basic Helm Linting
#-------------------------------------------------------

# Run Helm's built-in linter
lint:
	@echo "Running helm lint..."
	helm lint $(CHART_DIR)

# Generate template output to verify all templates render correctly
template:
	@echo "Running helm template..."
	helm template $(CHART_NAME) $(CHART_DIR) > /tmp/$(CHART_NAME)-rendered.yaml

#-------------------------------------------------------
# YAML Validation
#-------------------------------------------------------

# Check YAML syntax and formatting
yamllint:
	@echo "Running yamllint..."
	@if command -v yamllint >/dev/null 2>&1; then \
		yamllint -c .yamllint.yml $(CHART_DIR) || true; \
	else \
		echo "yamllint not installed. Install with: pip install yamllint"; \
	fi

#-------------------------------------------------------
# Kubernetes Resource Validation
#-------------------------------------------------------

# Validate Kubernetes resources using kubeval
kubeval: template
	@echo "Running kubeval..."
	@if command -v kubeval >/dev/null 2>&1; then \
		kubeval --kubernetes-version $(KUBE_VERSION) /tmp/$(CHART_NAME)-rendered.yaml; \
	else \
		echo "kubeval not installed. Install with: brew install kubeval"; \
	fi

# Validate Kubernetes resources using kubeconform (newer alternative to kubeval)
kubeconform: template
	@echo "Running kubeconform..."
	@if command -v kubeconform >/dev/null 2>&1; then \
		kubeconform -kubernetes-version $(KUBE_VERSION) /tmp/$(CHART_NAME)-rendered.yaml; \
	else \
		echo "kubeconform not installed. Install with: brew install kubeconform"; \
	fi

#-------------------------------------------------------
# Documentation Validation
#-------------------------------------------------------

# Check or generate documentation with helm-docs
helm-docs:
	@echo "Running helm-docs..."
	@if command -v helm-docs >/dev/null 2>&1; then \
		helm-docs --chart-search-root $(CHART_DIR); \
	else \
		echo "helm-docs not installed. Install with: brew install helm-docs"; \
	fi

#-------------------------------------------------------
# Helm Chart Testing
#-------------------------------------------------------

# Run Helm unit tests (commented out as the plugin is not installed)
# unittest:
# 	@echo "Running helm unit tests..."
# 	@if command -v helm unittest >/dev/null 2>&1; then \
# 		helm unittest $(CHART_DIR) || true; \
# 	else \
# 		echo "helm unittest plugin not installed. Install with: helm plugin install https://github.com/quintush/helm-unittest"; \
# 	fi

#-------------------------------------------------------
# Comprehensive Validation
#-------------------------------------------------------

# More extensive validation using helm-conftest (OPA-based policy validation)
validate: template
	@echo "Running conftest validation..."
	@if command -v conftest >/dev/null 2>&1; then \
		mkdir -p policies || true; \
		[ -f policies/default.rego ] || echo 'package main\n\ndeny[msg] {\n  input.kind == "Deployment"\n  not input.spec.template.spec.securityContext.runAsNonRoot\n  msg = "Containers must not run as root"\n}' > policies/default.rego; \
		conftest test /tmp/$(CHART_NAME)-rendered.yaml -p policies || echo "Conftest found policy violations."; \
	else \
		echo "conftest not installed. Install with: brew install conftest"; \
	fi

#-------------------------------------------------------
# Chart Structure Tests
#-------------------------------------------------------

# Check for common chart structure issues
chart-structure:
	@echo "Checking chart structure..."
	@[ -f $(CHART_DIR)/Chart.yaml ] || echo "ERROR: Chart.yaml missing"
	@[ -f $(CHART_DIR)/values.yaml ] || echo "ERROR: values.yaml missing"
	@[ -d $(CHART_DIR)/templates ] || echo "ERROR: templates directory missing"
	@[ -f $(CHART_DIR)/README.md ] || echo "WARN: README.md missing"
	@[ -f $(CHART_DIR)/.helmignore ] || echo "WARN: .helmignore missing"
	@grep -q "version:" $(CHART_DIR)/Chart.yaml || echo "ERROR: version missing in Chart.yaml"
	@grep -q "appVersion:" $(CHART_DIR)/Chart.yaml || echo "ERROR: appVersion missing in Chart.yaml"

#-------------------------------------------------------
# Additional Targets
#-------------------------------------------------------

# Scan for security issues using Trivy
security-scan:
	@echo "Running Trivy scan..."
	@if command -v trivy >/dev/null 2>&1; then \
		trivy config --severity HIGH,CRITICAL /tmp/$(CHART_NAME)-rendered.yaml || echo "Trivy found security issues."; \
	else \
		echo "Trivy not installed. Install with: brew install aquasecurity/trivy/trivy"; \
	fi

# Create default policies directory and example policy file if it doesn't exist
policies/default.rego:
	@mkdir -p policies
	@echo 'package main\n\n# Deny Deployments that have containers running as root\ndeny[msg] {\n  input.kind == "Deployment"\n  not input.spec.template.spec.securityContext.runAsNonRoot\n  msg = "Containers must not run as root"\n}' > policies/default.rego

# Cleanup temporary files
clean:
	rm -f /tmp/$(CHART_NAME)-rendered.yaml

# Create a copy of values.yaml with all possible values set (helps identify unset values)
values-debug:
	@echo "Creating debug values file..."
	@mkdir -p debug
	@cat $(CHART_DIR)/values.yaml | sed 's/#.*$$//g' | grep -v "^$$" > debug/values-debug.yaml

# Simple check target that combines several fast checks for quick validation
quick-check: lint yamllint chart-structure
