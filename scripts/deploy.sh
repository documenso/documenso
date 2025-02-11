#!/usr/bin/env bash


# Exit on error.
set -eo pipefail

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
CI_COMMIT_SHORT_SHA="$(git rev-parse --short HEAD)"
APP_NAME="documenso"
IMAGE_NAME="sunrebel/documenso"
CONTAINER_PORT=80
REVISION_NAME="TASK_DEFINITION_REVISION"

echo "Deploying Documenso to ECS"
echo "AWS cli version: $(aws --version)"

ECR_IMAGE="806620123734.dkr.ecr.us-west-2.amazonaws.com/${IMAGE_NAME}:${CI_COMMIT_SHORT_SHA}"
CURRENT_TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition "${APP_NAME}" --region "us-west-2")
CURRENT_REVISION=$(echo "$CURRENT_TASK_DEFINITION" | jq -r '.taskDefinition.revision')
echo "Current revision: $CURRENT_REVISION"
NEW_REVISION=$(($CURRENT_REVISION + 1))
echo "New revision: $NEW_REVISION"
NEW_CONTAINER_DEFINITIONS=$(echo "$CURRENT_TASK_DEFINITION" | jq --arg IMAGE "$ECR_IMAGE" --arg REVISION_NAME "$REVISION_NAME" --arg NEW_REVISION "$NEW_REVISION" '
    .taskDefinition.containerDefinitions |
    map(.image = $IMAGE |
        (.environment //= []) |
        .environment[] |= if .name == $REVISION_NAME then .value = $NEW_REVISION else . end
    )
')
NEW_TASK_DEFINITION=$(echo "$CURRENT_TASK_DEFINITION" | jq --argjson CONTAINERS "$NEW_CONTAINER_DEFINITIONS" '
    .taskDefinition |
    .containerDefinitions = $CONTAINERS |
    del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
')
NEW_TASK_INFO=$(aws ecs register-task-definition --region "us-west-2" --cli-input-json "$(echo "$NEW_TASK_DEFINITION" | jq -c)")    
NEW_TASK_ARN=$(echo $NEW_TASK_INFO | jq '.taskDefinition.taskDefinitionArn')
APPSPEC_CONTENT=$(cat <<EOF
{
    "version": 0.0,
    "Resources": [
        {
            "TargetService": {
                "Type": "AWS::ECS::Service",
                "Properties": {
                    "TaskDefinition": $NEW_TASK_ARN,
                    "LoadBalancerInfo": {
                        "ContainerName": "$APP_NAME",
                        "ContainerPort": $CONTAINER_PORT
                    }
                }
            }
        }
    ]
}
EOF
)

aws deploy create-deployment \
    --region "us-west-2" \
    --application-name "sr-codedeploy" \
    --deployment-group-name "${APP_NAME}" \
    --revision "{\"revisionType\": \"AppSpecContent\", \"appSpecContent\": {\"content\": $(echo "$APPSPEC_CONTENT" | jq -R -s .)}}"
