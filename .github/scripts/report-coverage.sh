#!/usr/bin/env bash
set -e

COVERAGE_FILE=${COVERAGE_FILE:-"coverage/coverage-summary.json"}
MIN_COVERAGE=${MIN_COVERAGE:-"70.0"}

if [ ! -f "$COVERAGE_FILE" ]; then
    echo "Coverage file not found: $COVERAGE_FILE"
    exit 1
fi

# Extract coverage metrics using jq
LINES_PCT=$(jq -r '.total.lines.pct' "$COVERAGE_FILE")
STMTS_PCT=$(jq -r '.total.statements.pct' "$COVERAGE_FILE")
FUNCS_PCT=$(jq -r '.total.functions.pct' "$COVERAGE_FILE")
BRNCH_PCT=$(jq -r '.total.branches.pct' "$COVERAGE_FILE")

# Generate the markdown table for the comment
MARKDOWN_BODY=$(cat <<EOF
## 📊 Code Coverage Report

| Metric | Percentage |
|---|---|
| **Lines** | ${LINES_PCT}% |
| **Statements** | ${STMTS_PCT}% |
| **Functions** | ${FUNCS_PCT}% |
| **Branches** | ${BRNCH_PCT}% |
EOF
)

# Output for GitHub Actions log
echo "$MARKDOWN_BODY"

# Post the comment to the Pull Request if we are in a PR context
if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "null" ]; then
    echo "Checking for existing coverage comment on PR #$PR_NUMBER..."
    COMMENT_ID=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" --jq '.[] | select(.user.login == "github-actions[bot]" and (.body | startswith("## 📊 Code Coverage Report"))) | .id' | head -n 1)

    if [ -n "$COMMENT_ID" ]; then
        echo "Updating existing comment #$COMMENT_ID..."
        gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$COMMENT_ID" -f body="$MARKDOWN_BODY" || echo "Failed to update comment."
    else
        echo "Posting new coverage comment to PR #$PR_NUMBER..."
        gh pr comment "$PR_NUMBER" --body "$MARKDOWN_BODY" || echo "Failed to post comment, check permissions."
    fi
else
    echo "Not running in a PR context (or PR_NUMBER is missing). Skipping comment."
fi

# Optional: Fail the build if lines coverage is below min-coverage
if (( $(echo "$LINES_PCT < $MIN_COVERAGE" | bc -l) )); then
    echo "❌ Code coverage ($LINES_PCT%) is below the minimum threshold ($MIN_COVERAGE%)."
    exit 1
fi
echo "✅ Code coverage ($LINES_PCT%) meets the minimum threshold."
