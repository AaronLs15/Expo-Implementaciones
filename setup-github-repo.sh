#!/bin/bash
# ============================================================
#  setup-github-repo.sh
#  Combines loginGoogle + mercadopago-expo-demo into ONE
#  new GitHub repo called "Expo-Implementaciones"
# ============================================================
set -e

REPO_NAME="Expo-Implementaciones"
PROJECTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "=================================================="
echo "  Setting up GitHub repo: $REPO_NAME"
echo "  Source folder: $PROJECTS_DIR"
echo "=================================================="
echo ""

# ── 1. Check for gh CLI ──────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "❌  GitHub CLI (gh) not found."
  echo ""
  echo "    Install it with Homebrew:"
  echo "      brew install gh"
  echo ""
  echo "    Or download from: https://cli.github.com"
  echo ""
  echo "    Then re-run this script."
  exit 1
fi
echo "✅  gh CLI found: $(gh --version | head -1)"

# ── 2. Authenticate if needed ────────────────────────────
if ! gh auth status &>/dev/null; then
  echo ""
  echo "⚠️   Not logged into GitHub. Starting login..."
  gh auth login
fi

GITHUB_USER=$(gh api user --jq '.login')
echo "✅  Authenticated as: $GITHUB_USER"
echo ""

# ── 3. Remove nested .git dirs (back them up first) ──────
echo "📦  Preparing project folders..."

for folder in loginGoogle mercadopago-expo-demo; do
  GIT_DIR="$PROJECTS_DIR/$folder/.git"
  BACKUP_DIR="$PROJECTS_DIR/$folder/.git_backup"
  if [ -d "$GIT_DIR" ]; then
    echo "    Moving $folder/.git → $folder/.git_backup (backup)"
    mv "$GIT_DIR" "$BACKUP_DIR"
  fi
done

# ── 4. Init git in the parent desarrolloweb folder ───────
cd "$PROJECTS_DIR"

if [ ! -d ".git" ]; then
  echo "📁  Initializing new git repo in desarrolloweb..."
  git init
  git branch -M main
else
  echo "ℹ️   Git repo already initialized."
fi

# ── 5. Create .gitignore if it doesn't exist ────────────
if [ ! -f ".gitignore" ]; then
  cat > .gitignore << 'EOF'
node_modules/
.expo/
dist/
build/
*.log
.DS_Store
.env
.env.local
EOF
  echo "📝  Created .gitignore"
fi

# ── 6. Stage and commit everything ───────────────────────
echo ""
echo "📋  Staging all files..."
git add .

if git diff --staged --quiet; then
  echo "ℹ️   Nothing new to commit — files already tracked."
else
  git commit -m "feat: initial commit — loginGoogle and mercadopago-expo-demo"
  echo "✅  Committed all files."
fi

# ── 7. Create GitHub repo ────────────────────────────────
echo ""
echo "🌐  Creating GitHub repository '$REPO_NAME'..."

if gh repo view "$GITHUB_USER/$REPO_NAME" &>/dev/null; then
  echo "ℹ️   Repo '$REPO_NAME' already exists on GitHub — skipping creation."
else
  gh repo create "$REPO_NAME" \
    --public \
    --description "Login Google and MercadoPago Expo implementations"
  echo "✅  Repository created on GitHub!"
fi

# ── 8. Set remote and push ───────────────────────────────
REMOTE_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"

if git remote get-url origin &>/dev/null; then
  echo "🔗  Remote 'origin' already set."
else
  git remote add origin "$REMOTE_URL"
  echo "🔗  Remote set → $REMOTE_URL"
fi

echo ""
echo "🚀  Pushing to GitHub..."
git push -u origin main

echo ""
echo "=================================================="
echo "  ✅  All done!"
echo ""
echo "  Your repo is live at:"
echo "  https://github.com/$GITHUB_USER/$REPO_NAME"
echo "=================================================="
echo ""
