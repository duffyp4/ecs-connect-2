#!/bin/bash

# GoCanvas Field Mapping Update Script
# Usage: ./update-gocanvas-mapping.sh <FORM_TYPE> [FORM_ID]
# Example: ./update-gocanvas-mapping.sh emissions 5695685

set -e

echo "🔧 GoCanvas Field Mapping Update Tool"
echo "======================================"

# Check if form type is provided
if [ -z "$1" ]; then
  echo "❌ No form type provided!"
  echo ""
  echo "Usage:"
  echo "  ./update-gocanvas-mapping.sh <FORM_TYPE> [FORM_ID]"
  echo ""
  echo "Form Types:"
  echo "  emissions  - Emissions Service Log form"
  echo "  pickup     - Pickup Log form"
  echo "  delivery   - Delivery Log form"
  echo ""
  echo "Examples:"
  echo "  ./update-gocanvas-mapping.sh emissions 5695685"
  echo "  ./update-gocanvas-mapping.sh pickup 5640587"
  echo "  ./update-gocanvas-mapping.sh delivery 5657146"
  echo ""
  exit 1
fi

FORM_TYPE="$1"

# Validate form type
if [[ "$FORM_TYPE" != "emissions" && "$FORM_TYPE" != "pickup" && "$FORM_TYPE" != "delivery" ]]; then
  echo "❌ Invalid form type: $FORM_TYPE"
  echo "Valid types: emissions, pickup, delivery"
  exit 1
fi

# Get form ID from argument or use defaults
if [ -n "$2" ]; then
  FORM_ID="$2"
  echo "📋 Using form ID from argument: $FORM_ID"
else
  # Default form IDs
  case "$FORM_TYPE" in
    emissions)
      FORM_ID="5695685"
      ;;
    pickup)
      FORM_ID="5640587"
      ;;
    delivery)
      FORM_ID="5657146"
      ;;
  esac
  echo "📋 Using default form ID for $FORM_TYPE: $FORM_ID"
fi

echo "📋 Form type: $FORM_TYPE"
echo "📋 Form ID: $FORM_ID"

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

# Run the field mapping script with both form type and ID
node scripts/buildFieldMap.js "$FORM_TYPE" "$FORM_ID"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Field mapping updated successfully!"
  echo ""
  echo "📊 Validation:"
  
  # Validate the mapping
  tsx -e "
    import { fieldMapper } from './shared/fieldMapper.js';
    const result = fieldMapper.validateMappingByType('$FORM_TYPE');
    console.log(result.valid ? '✅' : '❌', result.message);
    
    if (result.valid) {
      console.log('');
      console.log('🔍 Key fields found:');
      const keyFields = ['Job ID', 'Shop Name', 'Customer Name', 'User ID'];
      keyFields.forEach(label => {
        const id = fieldMapper.getFieldIdByType('$FORM_TYPE', label);
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
