export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['backend', 'frontend', 'docs', 'ci', 'infra', 'deps']],
    'scope-empty': [0],
    'body-max-line-length': [1, 'always', 100],
  },
};
