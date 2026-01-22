#!/bin/bash

# Deployment script for CloudFront
# Usage: ./deploy.sh <bucket-name> <distribution-id>
# Make sure AWS CLI is configured with the correct profile

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <bucket-name> <distribution-id>"
  exit 1
fi

BUCKET_NAME=$1
DISTRIBUTION_ID=$2

echo "Building the application..."
npm run build

echo "Checking if S3 bucket exists..."
if ! aws s3 ls s3://$BUCKET_NAME --region $(aws configure get region) > /dev/null 2>&1; then
  echo "Error: Bucket '$BUCKET_NAME' does not exist or you don't have access to it."
  echo "Please check the bucket name or create the bucket first."
  exit 1
fi

echo "Checking CloudFront distribution..."
if ! aws cloudfront get-distribution --id $DISTRIBUTION_ID > /dev/null 2>&1; then
  echo "Error: CloudFront distribution '$DISTRIBUTION_ID' does not exist or you don't have access to it."
  echo "Please check the distribution ID."
  exit 1
fi

echo "Uploading to S3..."
aws s3 sync dist/ s3://$BUCKET_NAME --delete

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

echo "Deployment complete!"