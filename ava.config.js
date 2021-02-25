export default {
    files: [ 'test/*.ts' ],
    extensions: [ 'js' ], // .ts added automatically (somehow)
    require: [
        'esm', // https://stackoverflow.com/a/55803624
        'source-map-support/register'
    ],
    typescript: {
        rewritePaths: {
            'test/': 'dist_test/test/'
        }
    }
};
