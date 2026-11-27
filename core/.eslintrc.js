module.exports = {
    'root': true,
    'env': {
        'browser': true,
        'node': false,
        'es2021': true
    },
    'extends': [
        'eslint:recommended',
        'plugin:vue/vue3-essential'
    ],
    'overrides': [
        {
            'files': ['script/*.js', '.eslintrc.js'],
            'env': {
                'node': true,
                'browser': false
            },
            'parserOptions': {
                'sourceType': 'script'
            }
        },
        {
            'files': ['*.config.js', 'packages/*/*.config.js', 'tests/**/*.mjs'],
            'env': {
                'node': true,
                'browser': false
            },
            'parserOptions': {
                'sourceType': 'module'
            }
        }
    ],
    'parserOptions': {
        'ecmaVersion': 'latest',
        'sourceType': 'module'
    },
    'plugins': [
        'vue'
    ],
    'rules': {
        'semi': ['error','always'],
        'no-multi-spaces': ['error', { ignoreEOLComments: false }],
        'quotes': ['error', 'single']
    }
};
