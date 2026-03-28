import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";

/**
 * Imports the pre-created ECR repository for Documenso container images.
 * The repository must exist before the first deploy.
 */
export class Registry extends Construct {
  public readonly repo: ecr.IRepository;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.repo = ecr.Repository.fromRepositoryName(
      this,
      "Repo",
      "documenso",
    );
  }
}
