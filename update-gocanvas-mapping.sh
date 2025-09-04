#!/bin/bash

# GoCanvas Field Mapping Update Script
# Usage: ./update-gocanvas-mapping.sh [FORM_ID]
# Example: ./update-gocanvas-mapping.sh 5584204

set -e

echo "🔧 GoCanvas Field Mapping Update Tool"
echo "======================================"

# Check if form ID is provided as argument
if [ -n "$1" ]; then
  export GOCANVAS_FORM_ID="$1"
  echo "📋 Using form ID from argument: $GOCANVAS_FORM_ID"
elif [ -n "$GOCANVAS_FORM_ID" ]; then
  echo "📋 Using form ID from environment: $GOCANVAS_FORM_ID"
else
  echo "❌ No form ID provided!"
  echo ""
  echo "Usage:"
  echo "  ./update-gocanvas-mapping.sh 5584204"
  echo "  OR set GOCANVAS_FORM_ID environment variable"
  echo ""
  exit 1
fi

# Check if credentials are set
if [ -z "$GOCANVAS_USERNAME" ] || [ -z "$GOCANVAS_PASSWORD" ]; then
  echo "❌ Missing GoCanvas credentials!"
  echo "Please set environment variables:"
  echo "  GOCANVAS_USERNAME"
  echo "  GOCANVAS_PASSWORD"
  echo ""
  exit 1
fi

echo ""
echo "🚀 Updating field mappings..."

# Run the field mapping script
node scripts/buildFieldMap.js

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Field mapping updated successfully!"
  echo ""
  echo "📊 Validation:"
  
  # Validate the mapping
  tsx -e "
    import { fieldMapper } from './shared/fieldMapper.js';
    const result = fieldMapper.validateMapping();
    console.log(result.valid ? '✅' : '❌', result.message);
    
    if (result.valid) {
      console.log('');
      console.log('🔍 Key fields found:');
      const keyFields = ['Job ID', 'Shop Name', 'Customer Name', 'User ID'];
      keyFields.forEach(label => {
        const id = fieldMapper.getFieldId(label);
        if (id) {
          console.log(\`  \${label} → \${id}\`);
        } else {
          console.log(\`  \${label} → NOT FOUND ⚠️\`);
        }
      });
    }
    
    process.exit(result.valid ? 0 : 1);
  "
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Ready to go! Your application will now use the updated field mappings."
    echo "💡 Restart your development server if it's currently running."
  else
    echo "⚠️  Validation failed. Please check the output above."
    exit 1
  fi
else
  echo "❌ Failed to update field mappings. Check the error above."
  exit 1
fi