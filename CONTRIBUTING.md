# Contributing to Documenso

If you plan to contribute to Documenso, please take a moment to feel awesome ✨ People like you are what open source is about ♥. Any contributions, no matter how big or small, are highly appreciated.

## Before getting started

- Before jumping into a PR be sure to search [existing PRs](https://github.com/documenso/documenso/pulls) or [issues](https://github.com/documenso/documenso/issues) for an open or closed item that relates to your submission.
- Select an issue from [here](https://github.com/documenso/documenso/issues) or create a new one
- Consider the results from the discussion on the issue
- Accept the [Contributor License Agreement](https://documen.so/cla) to ensure we can accept your contributions.

## Taking issues

Before taking an issue, ensure that:

- The issue has been assigned the public label
- The issue is clearly defined and understood
- No one has been assigned to the issue
- No one has expressed intention to work on it

You can then:

1. Comment on the issue with your intention to work on it
2. Begin work on the issue

Always feel free to ask questions or seek clarification on the issue.

## Developing

The development branch is <code>main</code>. All pull requests should be made against this branch. If you need help getting started, [join us on Discord](https://documen.so/discord).

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your
   own GitHub account and then
   [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device.
2. Create a new branch:

- Create a new branch (include the issue id and something readable):

  ```sh
  git checkout -b feat/doc-999-somefeature-that-rocks
  ```

3. See the [Developer Setup](https://github.com/documenso/documenso/blob/main/README.md#developer-setup) for more setup details.

## Building

> **Note**
> Please ensure you can make a full production build before pushing code or creating PRs.

You can build the project with:

```bash
npm run build
```
