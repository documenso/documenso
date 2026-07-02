import { AppErrorCode } from '@documenso/lib/errors/app-error';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { match } from 'ts-pattern';

export type ToastMessageDescriptor = {
  title: MessageDescriptor;
  description: MessageDescriptor;
};

export const RECIPIENT_LIMIT_EXCEEDED_ERROR_MESSAGE = {
  title: msg`Too many recipients`,
  description: msg`This document has too many recipients. Please remove some recipients or contact support if you need more.`,
};

export const FAIR_USE_LIMIT_EXCEEDED_ERROR_MESSAGE = {
  title: msg`Fair use limit exceeded`,
  description: msg`Your organisation has reached its plan's fair use limit. Please contact your organisation administrator or support to continue.`,
};

export const getDistributeErrorMessage = (code: string): ToastMessageDescriptor => {
  return match(code)
    .with('RECIPIENT_LIMIT_EXCEEDED', () => RECIPIENT_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .with(AppErrorCode.TOO_MANY_REQUESTS, () => FAIR_USE_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .otherwise(() => ({
      title: msg`Something went wrong`,
      description: msg`An error occurred while distributing the document.`,
    }));
};

export const getDirectTemplateErrorMessage = (code: string): ToastMessageDescriptor => {
  return match(code)
    .with('RECIPIENT_LIMIT_EXCEEDED', () => RECIPIENT_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .with(AppErrorCode.TOO_MANY_REQUESTS, () => FAIR_USE_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .otherwise(() => ({
      title: msg`Something went wrong`,
      description: msg`We were unable to submit this document at this time. Please try again later.`,
    }));
};

export const getUploadErrorMessage = (code: string): ToastMessageDescriptor => {
  return match(code)
    .with(AppErrorCode.TOO_MANY_REQUESTS, () => FAIR_USE_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .with('INVALID_DOCUMENT_FILE', () => ({
      title: msg`Error`,
      description: msg`You cannot upload encrypted PDFs.`,
    }))
    .with(AppErrorCode.LIMIT_EXCEEDED, () => ({
      title: msg`Error`,
      description: msg`You have reached your document limit for this month. Please upgrade your plan.`,
    }))
    .with('ENVELOPE_ITEM_LIMIT_EXCEEDED', () => ({
      title: msg`Error`,
      description: msg`You have reached the limit of the number of files per envelope.`,
    }))
    .with('UNSUPPORTED_FILE_TYPE', () => ({
      title: msg`Error`,
      description: msg`This file type isn't supported. Please upload a PDF or Word document.`,
    }))
    .with('CONVERSION_SERVICE_UNAVAILABLE', () => ({
      title: msg`Error`,
      description: msg`Document conversion is temporarily unavailable. Please try again shortly or upload a PDF.`,
    }))
    .with('CONVERSION_FAILED', () => ({
      title: msg`Error`,
      description: msg`We couldn't convert this file. Please check it's a valid Word document or upload a PDF instead.`,
    }))
    .otherwise(() => ({
      title: msg`Error`,
      description: msg`An error occurred while uploading your document.`,
    }));
};

export const getTemplateUseErrorMessage = (code: string): ToastMessageDescriptor => {
  return match(code)
    .with('DOCUMENT_SEND_FAILED', () => ({
      title: msg`Error`,
      description: msg`The document was created but could not be sent to recipients.`,
    }))
    .with(AppErrorCode.INVALID_BODY, AppErrorCode.INVALID_REQUEST, () => ({
      title: msg`Error`,
      description: msg`The document could not be created because of missing or invalid information. Please review the template's recipients and fields.`,
    }))
    .with(AppErrorCode.NOT_FOUND, () => ({
      title: msg`Error`,
      description: msg`The template or one of its recipients could not be found.`,
    }))
    .with(AppErrorCode.LIMIT_EXCEEDED, () => ({
      title: msg`Error`,
      description: msg`You have reached your document limit for this plan. Please upgrade your plan.`,
    }))
    .with(AppErrorCode.TOO_MANY_REQUESTS, () => FAIR_USE_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .otherwise(() => ({
      title: msg`Error`,
      description: msg`An error occurred while creating document from template.`,
    }));
};
