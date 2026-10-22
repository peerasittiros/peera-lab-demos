const noLiteralString = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hard-coded text in JSX; render translated messages instead.',
    },
    schema: [],
    messages: {
      hardcoded: 'Move this user-facing text to the locale message files.',
    },
  },
  create(context) {
    function isNonEmptyText(value) {
      return typeof value === 'string' && value.trim().length > 0;
    }

    return {
      JSXText(node) {
        if (isNonEmptyText(node.value))
          context.report({ node, messageId: 'hardcoded' });
      },
      JSXExpressionContainer(node) {
        if (
          node.expression.type === 'Literal' &&
          isNonEmptyText(node.expression.value)
        ) {
          context.report({ node, messageId: 'hardcoded' });
        }
      },
    };
  },
};

export default { rules: { 'no-literal-string': noLiteralString } };
