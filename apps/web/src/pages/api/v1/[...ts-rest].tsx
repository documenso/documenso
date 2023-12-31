import { createNextRouter } from '@documenso/api/next';
import { ApiContractV1 } from '@documenso/api/v1/contract';
import { ApiContractV1Implementation } from '@documenso/api/v1/implementation';

export default createNextRouter(ApiContractV1, ApiContractV1Implementation);
