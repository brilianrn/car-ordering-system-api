#!/bin/bash
set -e  # Script akan berhenti jika ada perintah yang gagal

# Configuration
AWS_ACCOUNT_ID="910637289303"
REGION="ap-southeast-3"
IMAGE_NAME="carorder-apps-be"
ECR_URL="$AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$IMAGE_NAME"

echo "--- 1. Authenticating with AWS ECR ---"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URL

echo "--- 2. Building Image (Linux AMD64 for AWS) ---"
docker build --platform linux/amd64 -t $IMAGE_NAME .

echo "--- 3. Tagging Image ---"
docker tag $IMAGE_NAME:latest $ECR_URL:latest

echo "--- 4. Pushing Image to ECR ---"
docker push $ECR_URL:latest

echo "--------------------------------------------------------"
echo "DONE: Image has been pushed successfully!"
echo "--------------------------------------------------------"