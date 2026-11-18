import type { TLocalContent } from '@documenso/lib/client-only/hooks/use-editor-contents';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  CONTENT_HIGHLIGHT_META_DEFAULT_VALUES,
  CONTENT_LINE_META_DEFAULT_VALUES,
  CONTENT_SHAPE_META_DEFAULT_VALUES_BY_SHAPE,
  CONTENT_TEXT_META_DEFAULT_VALUES,
  EnvelopeContentType,
  type TEnvelopeContentMeta,
  ZContentHighlightMetaSchema,
  ZContentLineMetaSchema,
  ZContentShapeMetaSchema,
  ZContentTextMetaSchema,
} from '@documenso/lib/types/envelope-content-meta';
import { Form } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createContext, useContext, useLayoutEffect, useState } from 'react';
import { type FieldValues, useForm, useFormContext } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

type ContentSettingsFormProviderProps = {
  content: TLocalContent | null;

  children: React.ReactNode;
};

/**
 * Every surface which edits a content's presentational meta (sidebar panel,
 * canvas action bar) must bind to this one form via `useContentSettingsForm`,
 * so there is only one copy of the values. Geometry is owned by the canvas and
 * is never part of the form.
 *
 * The provider wraps the whole editor surface, so it must not remount when the
 * selection changes; the one form is reset to the new content's values instead.
 */
export const ContentSettingsFormProvider = ({ content, children }: ContentSettingsFormProviderProps) => {
  const { editorContents } = useCurrentEnvelopeEditor();

  const config = getContentSettingsFormConfig(content?.contentMeta ?? null);

  // The resolver is read on every render, so the schema follows the selected content's type.
  const form = useForm<FieldValues>({
    resolver: zodResolver(config.schema),
    mode: 'onChange',
    defaultValues: config.defaultValues,
  });

  const formId = content?.formId ?? null;

  // The reset below runs after the render which changed the selection, so for
  // that one render the form still holds the previous content's values. Inputs
  // must not mount during it: a Radix select which mounts with one value and is
  // immediately given another pushes an empty string back into the form (its
  // hidden native select has no options yet), surfacing as a spurious validation error.
  const [readyFormId, setReadyFormId] = useState<string | null>(null);

  // Reset before subscribing so the reset is not observed as an edit. A layout
  // effect so the fields beneath never paint the previous content's values.
  useLayoutEffect(() => {
    form.reset(config.defaultValues);
    setReadyFormId(formId);

    if (!formId) {
      return;
    }

    const subscription = form.watch((values) => {
      const parsed = config.schema.safeParse(values);

      if (!parsed.success) {
        return;
      }

      editorContents.patchContentMeta(formId, parsed.data);
    });

    return () => subscription.unsubscribe();
    // Only the selected content matters; its config is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, formId, editorContents.patchContentMeta]);

  const isReady = formId !== null && formId === readyFormId;

  return (
    <ContentSettingsFormContext.Provider value={{ content, isReady }}>
      <Form {...form}>{children}</Form>
    </ContentSettingsFormContext.Provider>
  );
};

export const useContentSettingsForm = <TForm extends FieldValues>() => {
  const context = useContext(ContentSettingsFormContext);

  if (!context) {
    throw new Error('useContentSettingsForm must be used within a ContentSettingsFormProvider');
  }

  const form = useFormContext<TForm>();

  return {
    form,

    content: context.content,

    isReady: context.isReady,
  };
};

type ContentSettingsFormContextValue = {
  content: TLocalContent | null;
  isReady: boolean;
};

const ContentSettingsFormContext = createContext<ContentSettingsFormContextValue | null>(null);

type ContentSettingsFormConfig = {
  schema: z.ZodType<Partial<TEnvelopeContentMeta>>;
  defaultValues: FieldValues;
};

export const ZContentTextFormSchema = ZContentTextMetaSchema.pick({
  text: true,
  fontSize: true,
  textAlign: true,
  verticalAlign: true,
  lineHeight: true,
  letterSpacing: true,
  color: true,
});

export type TContentTextFormSchema = z.infer<typeof ZContentTextFormSchema>;

export const ZContentLineFormSchema = ZContentLineMetaSchema.pick({
  strokeWidth: true,
  strokeColor: true,
  strokeStyle: true,
});

export type TContentLineFormSchema = z.infer<typeof ZContentLineFormSchema>;

export const ZContentShapeFormSchema = ZContentShapeMetaSchema.pick({
  strokeWidth: true,
  strokeColor: true,
  strokeStyle: true,
  fillColor: true,
  fillOpacity: true,
});

export type TContentShapeFormSchema = z.infer<typeof ZContentShapeFormSchema>;

export const ZContentHighlightFormSchema = ZContentHighlightMetaSchema.pick({
  color: true,
  fillOpacity: true,
});

export type TContentHighlightFormSchema = z.infer<typeof ZContentHighlightFormSchema>;

const ZEmptyFormSchema = z.object({});

const getContentSettingsFormConfig = (meta: TEnvelopeContentMeta | null): ContentSettingsFormConfig => {
  if (!meta) {
    return { schema: ZEmptyFormSchema, defaultValues: {} };
  }

  return match(meta)
    .with({ type: EnvelopeContentType.TEXT }, (value) =>
      createFormConfig(ZContentTextFormSchema, CONTENT_TEXT_META_DEFAULT_VALUES, value),
    )
    .with({ type: EnvelopeContentType.LINE }, (value) =>
      createFormConfig(ZContentLineFormSchema, CONTENT_LINE_META_DEFAULT_VALUES, value),
    )
    .with({ type: EnvelopeContentType.SHAPE }, (value) =>
      createFormConfig(ZContentShapeFormSchema, CONTENT_SHAPE_META_DEFAULT_VALUES_BY_SHAPE[value.shape], value),
    )
    .with({ type: EnvelopeContentType.HIGHLIGHT }, (value) =>
      createFormConfig(ZContentHighlightFormSchema, CONTENT_HIGHLIGHT_META_DEFAULT_VALUES, value),
    )
    .with({ type: EnvelopeContentType.IMAGE }, () => ({ schema: ZEmptyFormSchema, defaultValues: {} }))
    .exhaustive();
};

const createFormConfig = <TSchema extends z.ZodType<Partial<TEnvelopeContentMeta>>>(
  schema: TSchema,
  defaults: TEnvelopeContentMeta,
  meta: TEnvelopeContentMeta,
): ContentSettingsFormConfig => {
  const merged = { ...defaults, ...meta };

  const parsed = schema.safeParse(merged);

  return {
    schema,
    // The stored meta was validated on load, so this only falls back if the
    // defaults themselves are ever inconsistent with the form schema.
    defaultValues: parsed.success ? parsed.data : schema.parse(defaults),
  };
};
