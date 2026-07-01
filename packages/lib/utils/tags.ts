export type EnvelopeTagWithTag<TTag> = {
  tag: TTag;
};

export const mapEnvelopeTagsToTags = <TTag>(envelopeTags?: EnvelopeTagWithTag<TTag>[] | null) => {
  return (envelopeTags ?? []).map((envelopeTag) => envelopeTag.tag);
};
